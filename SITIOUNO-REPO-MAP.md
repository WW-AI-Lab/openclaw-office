# Mapa de Repositorios SitioUno / OpenClaw

Este repo es el **repo grafico y de producto UI**. Su trabajo es mostrar y operar OpenClaw Office desde el navegador: oficina visual, consola, chat, settings, i18n, assets y scripts de servicio del frontend.

## Dueño de Cada Cosa

| Area | Repo canonico | Que vive ahi |
| --- | --- | --- |
| UI grafica OpenClaw Office | `sitiouno/openclaw-office` | React/Vite, oficina 2D, consola, chat, assets, i18n, CLI `openclaw-office`, deploy local de UI. |
| Infra GCP y nodos | `sitiouno/gcloud-office` | Terraform, scripts GCP, registry, MCP `kaspar-tools`, contratos de delegacion, runbooks de sucursales, fichas de Sicilia/Zeus/MiroFish. |
| Software Factory | `SiteOneTech/sitiouno-software-factory-ai` | Oficina/servicio especializado para tareas de programacion y automatizacion de desarrollo. |
| Zeus / Hermes | `SiteOneTech/hermes-agent` | Fork/configuracion del producto Hermes Agent, despliegue Zeus, Honcho, MCPs propios de Zeus. |
| MiroFish | `SiteOneTech/mirofish-original-ai-forecast` | Producto simulador AI Forecast, backend/frontend del simulador y despliegues propios. |

## Regla Practica

- Si cambia una pantalla, componente, traduccion, asset, flujo visual, chat UI o consola: va en este repo.
- Si cambia una VM, VPN, Tailscale, systemd, Terraform, registry, MCP de infraestructura o runbook de nodo: va en `gcloud-office`.
- Si cambia una capacidad de programacion como servicio o una oficina de desarrollo: va en `sitiouno-software-factory-ai`.
- Si cambia la identidad/runtime de Zeus como agente Hermes: va en `hermes-agent`; este repo solo puede consumirlo o enlazarlo desde UI.
- Si cambia el simulador MiroFish: va en `mirofish-original-ai-forecast`; este repo solo puede enlazarlo o mostrar su estado.

## Local Skills

`local-skills/` queda como zona transicional para skills que el Office distribuye junto con la experiencia local. Nuevas skills de infraestructura multi-nodo deben preferir `gcloud-office` o el repo especifico del agente/servicio que las consume.

## No Guardar Aqui

- API keys, tokens de gateway, tokens Tailscale, credenciales GitHub o `.env`.
- Estado runtime de gateways, sesiones, logs, bases SQLite, backups o historiales de chat.
- Clones completos de `gcloud-office`, `hermes-agent`, `mirofish-original-ai-forecast` o la factory.
