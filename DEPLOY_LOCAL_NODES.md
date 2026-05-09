# Protocolo de Despliegue UI y Sincronización de Nodos Locales

Este documento establece las reglas para desplegar **este frontend** en nodos locales. La infraestructura del nodo, registry, MCP, VPN y contratos de delegación se mantienen en `sitiouno/gcloud-office`.

Ver tambien: [SITIOUNO-REPO-MAP.md](SITIOUNO-REPO-MAP.md).

## 1. Responsabilidad Estricta
Ningún agente DevOps local debe intentar conectarse por SSH, Bastion o VPN para hacer despliegues en infraestructura externa (HQ u otros nodos). Cada nodo debe tener su propio agente vigilante que haga un `pull` de este repositorio y compile los binarios localmente.

## 2. Sincronización de Skills Locales
La carpeta `/local-skills` dentro de este repositorio actúa como el canal de distribución para custom skills entre sucursales.
- **Acción requerida (DevOps Local):** Monitorear esta carpeta. Si hay cambios o nuevos skills, el agente debe copiarlos al directorio global local del nodo (`~/.local/npm-global/lib/node_modules/openclaw/skills/` o equivalente) para que OpenClaw los registre en el Gateway.
- Si un agente en un nodo crea un skill útil, el DevOps de ese nodo debe hacerle commit y push hacia esta carpeta `/local-skills` para compartirlo con el ecosistema.
