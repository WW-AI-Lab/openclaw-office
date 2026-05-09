# Tarea de Refactorización: WikiViewerModal
**Contexto:** El fundador rechazó el componente WikiViewerModal.tsx actual. La UI con el grafo (react-force-graph-2d) es muy lenta, se superpone el botón de cerrar y la experiencia general es mala.

**Objetivos:**
1. Desinstalar `react-force-graph-2d` y `d3-force` usando pnpm.
2. Refactorizar `src/components/console/agents/WikiViewerModal.tsx`:
   - Elimina todo rastro del grafo y la variable `viewMode`.
   - Crea un layout de dos columnas:
     - Izquierda (Sidebar): Una lista de archivos mockeados (e.g., `index.md`, `SOUL.md`, `AGENTS.md`).
     - Derecha (Main Content): Renderiza el texto Markdown simulado correspondiente al archivo seleccionado en la izquierda usando `react-markdown`.
   - Repara el botón "X" de cerrar para que no quede montado sobre el título. Ponlo limpio en la esquina del modal.
3. Asegúrate de compilar con `pnpm build` para revisar errores de TypeScript.
4. Usa `git add .` y `git commit -m "refactor: Overhaul WikiViewer UX for fluid text-first navigation"`.
