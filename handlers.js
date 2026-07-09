const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

const settings = require("./settings.json");

// Deployment paths on the target appliance (user "bosca").
const SETTINGS_OUTPUT_PATH = "/etc/bosca/settings.json";
const SSH_KEY_PATH = "/home/bosca/.ssh/id_rsa";
const CERT_PATH = "/home/bosca/cert.pem";
const KEY_PATH = "/home/bosca/key.pem";

// The template stays pristine; each run renders a fresh copy with the Net2 IP.
const SAN_TEMPLATE_PATH = path.join(__dirname, "san.cnf");
const SAN_GENERATED_PATH = path.join(__dirname, "san.generated.cnf");

const handlerObj = {
    "/": home,
    "/run": message
};

async function serveHtml(res, file, statusCode = 200) {
    try {
        const data = await fsp.readFile(path.join(__dirname, file));
        res.writeHead(statusCode, { "Content-Type": "text/html" });
        res.end(data);
    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify(err));
    }
}

function postJson(urlString, headers, bodyObj) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const body = JSON.stringify(bodyObj);
        const client = url.protocol === "http:" ? http : https;

        const req = client.request(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                    ...headers
                }
            },
            (response) => {
                let data = "";
                response.on("data", (chunk) => { data += chunk; });
                response.on("end", () => resolve({ statusCode: response.statusCode, body: data }));
            }
        );

        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

function home(res) {
    serveHtml(res, "index.html");
}

async function message(res, payload) {
    const msg = new URLSearchParams(payload);

    // 1 - check secret
    if (msg.get("pass") !== settings.secret) {
        return serveHtml(res, "fail.html");
    }

    try {
        // 2 - create site config
        const net2IP = msg.get("net2IP");
        const net2Port = msg.get("net2Port");

        const config = {
            // Per-site identity (from the init input settings.json + form)
            siteId: settings.siteId,
            subdomain: settings.subdomain,
            tenantId: msg.get("tenantId"),
            CLOUD_API_BASE_URL: settings.CLOUD_API_BASE_URL,
            apiKey: msg.get("apiKey"),

            // Net2 connection (from the form)
            Net2ApiBaseURL: `https://${net2IP}:${net2Port}/api/V1/`,
            Net2ApiHubBaseURL: `https://${net2IP}:${net2Port}`,
            NET2_USER: msg.get("net2User"),
            NET2_USER_PW: msg.get("net2Pass"),
            NET2_CLIENT_ID: msg.get("net2ClientId"),

            // Site defaults consumed by bosca.shield's ConfigProvider.
            // Keys/values mirror bosca.shield/etc/bosca/settings.json.
            Net2LocalTimeOffset: "0.0",
            GatewayAddress: "localhost",
            GatewayPort: "4000",
            GatewayCertificateAuthorityFile: "certs/ca.crt",
            SupremaHistoricalSyncBatchSize: "1000",
            Net2SyncTimerInMinutes: "1",
            SupremaLogServerMinutes: "1",
            FaceScannerBackgroundWorkerMinutes: "1",
            Net2EventsSyncSagaRefreshMinutes: "1",
            Net2EventsSyncSagaProcessorResponseTimeOut: "5",
            SupremaEventsSyncSagaRefreshMinutes: "1",
            SupremaEventsSyncSagaProcessorResponseTimeOut: "5",
            RollCallEventId: "1",
            EventsFilterInDays: "-400",
            EventsImportMaxRowCount: "950",
            DefaultForceInTime: "07:35",
            DefaultForceOutTime: "18:45",
            UserEnteredZoneTimeout: "23:59",
            StatusQueueSize: "16",
            CodeMapFile: "event/event_code.json",
            DemoDevicePort: "51211",
            DemoDeviceUseSSL: "false",
            GCPProjectId: "cairn-integration",
            LogFilePath: "../logs/",
            LogLabelServiceKey: "bosca-shield",
            LogLabelServerSiteIdLabel: "bosca-shield-server-siteid",
            CloudMasterMode: "true",
            UseServiceControl: "false",
            DefaultEventSyncEnabled: "true"
        };

        await fsp.writeFile(SETTINGS_OUTPUT_PATH, JSON.stringify(config, null, 2));

        // 3 - generate a TLS cert for the Net2 controller IP
        const template = await fsp.readFile(SAN_TEMPLATE_PATH, "utf8");
        await fsp.writeFile(SAN_GENERATED_PATH, template.replace("net-2-ip", net2IP));
        await exec(`sh generate-cert.sh ${SAN_GENERATED_PATH}`);

        // 4 - register the site with the cloud
        const [privateKey, authorityCert, authorityKey] = await Promise.all([
            fsp.readFile(SSH_KEY_PATH, "utf8"),
            fsp.readFile(CERT_PATH, "utf8"),
            fsp.readFile(KEY_PATH, "utf8")
        ]);

        const siteObj = {
            id: settings.siteId,
            name: msg.get("siteName"),
            subDomain: settings.subdomain,
            privateKey,
            authorityCert,
            authorityKey
        };

        const response = await postJson(
            settings.CLOUD_API_BASE_URL + "/Site/RegisterSite",
            {
                "ApiKey": msg.get("apiKey"),
                "X-TenantId": msg.get("tenantId")
            },
            siteObj
        );

        if (response.statusCode !== 200) {
            console.error(`RegisterSite failed with status ${response.statusCode}: ${response.body}`);
            return serveHtml(res, "fail.html");
        }

        // 5 - respond, then reboot
        await serveHtml(res, "done.html");
        exec("sudo /sbin/shutdown -r now").catch((err) => console.error(err));
    } catch (err) {
        console.error(err);
        return serveHtml(res, "fail.html");
    }
}

module.exports = {
    home,
    message,
    handlerObj
};
