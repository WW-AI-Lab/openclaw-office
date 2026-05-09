<skill>
  <name>prompt-architect</name>
  <description>Skill activa de ingeniería de prompts de alta densidad. Utiliza estructuras XML (<identity>, <instructions>, <constraints>, <context>), delimitación de roles estrictos y control de verbosidad basado en los leaks de Codex/Claude y la arquitectura OpenClaw. Úsala para reescribir perfiles de agentes (AGENTS.md, SOUL.md, etc.) asegurando máxima obediencia, seguridad y capacidad analítica.</description>
</skill>

# Arquitectura de Prompts de Alta Densidad (Prompt Architect)

## 1. Principios Core
- **Cadena de Mando:** El `developer` manda. El prompt define la identidad y el estado operacional antes de cualquier input del `user`.
- **Delimitación XML:** Todo contexto, instrucción o ejemplo debe estar en tags (`<identity>`, `<rules>`, `<workspace>`, `<tools>`).
- **Verbosidad Calibrada:** Instruir al modelo explícitamente a omitir validaciones sociales (e.g. "Entendido", "Aquí tienes").

## 2. Estructura Estándar para Agentes OpenClaw
Todo perfil de agente debe contener:
- `<role>`: Quién es y su función en la red.
- `<capabilities>`: Qué sabe hacer (lenguajes, frameworks, integraciones).
- `<constraints>`: Límites de seguridad duros.
- `<output_format>`: Cómo debe hablar y entregar resultados.