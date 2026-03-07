#!/bin/sh
set -eu

cat >/usr/share/nginx/html/runtime-config.js <<EOF
window.__OPENCLAW_CONFIG__ = {
  gatewayUrl: "${OPENCLAW_GATEWAY_URL:-}",
  gatewayToken: "${OPENCLAW_GATEWAY_TOKEN:-}"
};
EOF

exec "$@"
