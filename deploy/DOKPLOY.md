# Dokploy Deploy (BUILDGEN Office)

## 1) Create app in Dokploy
- Type: **Dockerfile**
- Repository: `https://github.com/vitaliy-volkov/buildgen-office`
- Branch: `main`
- Dockerfile path: `Dockerfile`
- Port: `80`

## 2) Environment variables
Set in Dokploy project:

- `OPENCLAW_GATEWAY_URL=wss://<your-openclaw-gateway-domain>`
- `OPENCLAW_GATEWAY_TOKEN=<your-gateway-token>`

`runtime-config.js` is generated on container start from these envs.

## 3) Domain + TLS
- Attach domain in Dokploy (e.g. `office.buildgen.ai`)
- Enable HTTPS (Let's Encrypt)

## 4) Security (recommended)
- Put office behind access control (Cloudflare Access or basic auth)
- Rotate gateway token periodically

## 5) Verify
Open your URL and confirm:
- connection status = Connected
- agents stream in real-time
- tool calls and statuses visible
