<skill>
  <name>llm-wiki</name>
  <description>Implementa el patrón de base de conocimiento persistente basado en Markdown (Karpathy 'llm-wiki'). Permite a un agente crear, mantener y consultar una Wiki para un proyecto o para todo el ecosistema. Mantiene un index.md (catálogo) y un log.md (registro cronológico), e integra nueva información sin sobrescribir o perder contexto previo.</description>
</skill>

# Patrón LLM-Wiki (Knowledge Base Persistente)

## 1. Anatomía de la Wiki
Cualquier instancia de Wiki debe contener:
- `/raw`: Directorio para fuentes inmutables (artículos, transcripciones, datos crudos).
- `index.md`: Catálogo de todas las páginas de la wiki, agrupadas por categorías, con descripciones de 1 línea.
- `log.md`: Registro cronológico ("append-only") de operaciones. Formato: `## [YYYY-MM-DD] accion | Target`.
- `/*.md`: Páginas de entidades, conceptos, resúmenes e integraciones.

## 2. Flujo de Ingesta (Ingest)
Cuando se agrega una fuente:
1. El agente lee el documento original en `/raw`.
2. Extrae las ideas clave, conceptos y entidades.
3. Actualiza o crea páginas `.md` en la wiki interconectándolas (cross-references).
4. Actualiza el `index.md` si se crearon páginas nuevas.
5. Añade una entrada al final de `log.md`.

## 3. Escalabilidad
Este patrón puede instanciarse a nivel global (ej. `~/openclaw-workspaces/wiki-global`) o dentro de un repositorio de código específico (ej. `/src/docs/wiki`).