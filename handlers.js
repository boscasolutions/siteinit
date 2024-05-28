const fs = require("fs");

const handlerObj = {
    "/": home,
    "/run": message
};

settings = require('./settings.json');
var request = require('request');

function home(res) {
    fs.readFile(__dirname + "/index.html", (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}

function message(res, payload) {
    let msg = new URLSearchParams(payload);

    // 1 - check secret

    if(msg.get('pass') !== settings.secret) {
        fs.readFile(__dirname + "/fail.html", (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end(JSON.stringify(err));
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });

        return;
    }

    // 2 - create site config

    let config = {
        apiKey: msg.get('apiKey'),
        siteId: settings.siteId,
        subdomain: settings.subdomain,
        Net2ApiBaseURL: 'https://' + msg.get('net2IP') + '/api/V1/',
        Net2ApiHubBaseURL: 'https://' + msg.get('net2IP'),
        NET2_USER: msg.get('net2User'),
        NET2_USER_PW: msg.get('net2Pass'),
        NET2_CIENT_ID: msg.get('net2ClientId'),
        CLOUD_API_BASE_URL: settings.CLOUD_API_BASE_URL,
    };

    fs.writeFile("/etc/bosca/settings.json", JSON.stringify(config, null, 2), (err) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
        }
    });

    // 3 - register site

    var privateKey = fs.readFileSync('/home/bosca/.ssh/id_rsa').toString();
    var authorityCert = fs.readFileSync('/home/bosca/cert.pem').toString();
    var authorityKey = fs.readFileSync('/home/bosca/key.pem').toString();

    var siteObj = { 
        id: settings.siteId,
        name: msg.get('siteName'),
        subDomain: settings.subdomain,
        privateKey: privateKey,
        authorityCert: authorityCert,
        authorityKey: authorityKey
    };
    request({
        url: settings.CLOUD_API_BASE_URL + "/Site/RegisterSite",
        method: "POST",
        json: true,  
        headers: {
            'ApiKey': msg.get('apiKey')
        },
        body: siteObj
    }, function (error, response, body){
        if(response.statusCode == 200){

            // 4 - reboot
            require('child_process').exec('sudo /sbin/shutdown -r now', function (msg) { console.log(msg) });

            fs.readFile(__dirname + "/done.html", (err, data) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        }else{
            fs.readFile(__dirname + "/fail.html", (err, data) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        }
    });
}

module.exports = { 
    home, 
    message,
    handlerObj
};