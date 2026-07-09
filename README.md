# siteinit

First-boot provisioning wizard for Bosca / CloudLoq edge **site servers**.

On a fresh appliance an operator opens a local web form, submits the site's
Net2 access-control credentials and cloud API details, and the server:

1. Validates a shared secret password.
2. Writes the site's runtime configuration to `/etc/bosca/settings.json`.
3. Generates a self-signed TLS certificate for the Net2 controller and installs
   it as a locally trusted CA.
4. Registers the site with the cloud via `POST {CLOUD_API_BASE_URL}/Site/RegisterSite`.
5. Reboots the machine.

This is a one-time bootstrap tool, not a long-running service.

## Architecture

```
app.js       → wires the server, router and handlers together
server.js    → raw Node http server (PORT, default 8000); buffers the request body
router.js    → maps exact paths to handlers (GET / and POST /run)
handlers.js  → the provisioning pipeline
index.html   → the setup form
done.html    → success page
fail.html    → failure page
generate-cert.sh → OpenSSL cert generation + CA install
san.cnf      → OpenSSL SAN template (IP.1 = net-2-ip is substituted at runtime)
```

## Requirements

- Node.js >= 12
- Linux appliance with:
  - a `bosca` user
  - `sudo` (for reboot and copying certs into the trust store)
  - `openssl` and `update-ca-certificates`
  - an existing SSH key at `/home/bosca/.ssh/id_rsa`
  - a writable `/etc/bosca/`
- Network access to the cloud API and the Net2 controller

## Configuration

Create a `settings.json` in the project root (see `settings.example.json`):

```json
{
  "secret": "shared-secret-password-for-the-setup-form",
  "siteId": "00000000-0000-0000-0000-000000000000",
  "subdomain": "example-site",
  "CLOUD_API_BASE_URL": "https://api.cloudloq.example.com"
}
```

`settings.json` holds a secret and is git-ignored — do not commit it.

The form itself collects the per-site values: `pass`, `apiKey`, `tenantId`,
`siteName`, `net2IP`, `net2Port`, `net2User`, `net2Pass`, `net2ClientId`.

## Running

```bash
npm install        # installs dev tooling (nodemon); no runtime dependencies
npm start          # node app.js
PORT=8080 npm start
npm run dev        # auto-reload via nodemon
```

Then browse to `http://<host>:8000/` and complete the form.

## Notes

- The app uses only Node built-ins (`http`/`https`) — no third-party HTTP client.
- `san.cnf` is treated as a pristine template; each run renders `san.generated.cnf`
  with the submitted Net2 IP so re-runs stay correct.
- Because provisioning transmits credentials and an SSH private key, run it on a
  trusted local network and reboot promptly.
