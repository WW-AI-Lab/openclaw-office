import type { AgentSummary } from "@/gateway/types";
import { Info, BookOpen, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { WikiViewerModal } from "./WikiViewerModal";

interface LocalSkillsTabProps {
  agent: AgentSummary;
}

export function LocalSkillsTab({ agent }: LocalSkillsTabProps) {
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const vaultPath = `/home/magnus-vaos/openclaw-workspaces/${agent.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(vaultPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenObsidian = async () => {
    try {
      // Trigger via backend exec to open the folder in Obsidian
      await fetch(`/api/v1/agents/${agent.id}/tools/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          command: `obsidian`,
          background: true 
        })
      });
      // Fallback via URI directly in browser
      window.location.href = `obsidian://open?path=${vaultPath}`;
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yellow-500/20 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-yellow-400" />
          <div>
            <h3 className="text-sm font-medium text-yellow-400">SitioUno Local Skills & Knowledge</h3>
            <p className="mt-1 text-sm text-gray-400">
              Estas son las skills inyectadas localmente en este nodo por el equipo de DevOps.
              Las skills locales se inyectan a nivel del sistema de archivos (npm-global), por lo tanto están habilitadas globalmente para todos los agentes del nodo.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-400" />
            <h4 className="font-medium text-gray-200">Knowledge Base (Wiki)</h4>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWikiOpen(true)}
              className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-zinc-700 transition-colors border border-gray-700"
            >
              Ver en Web
            </button>
            <button
              onClick={handleOpenObsidian}
              className="flex items-center gap-2 rounded-md bg-[#7c3aed] px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-purple-500/20 hover:bg-[#6d28d9] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Obsidian
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-black/40 rounded-md p-2 border border-gray-800">
          <code className="text-xs text-gray-400 font-mono select-all overflow-x-auto whitespace-nowrap px-2">
            {vaultPath}
          </code>
          <button 
            onClick={copyToClipboard}
            className="flex items-center justify-center p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors ml-2 shrink-0"
            title="Copiar ruta al portapapeles"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Si el botón de Obsidian no responde, copia la ruta superior y usa "Open folder as vault" directamente en la app.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-zinc-950 p-4 opacity-75">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-200">prompt-architect</h4>
            <span className="rounded bg-gray-500/10 px-2 py-0.5 text-xs text-gray-400">Global Read-Only</span>
          </div>
          <p className="mt-2 text-sm text-gray-400 line-clamp-2">
            Skill activa de ingeniería de prompts de alta densidad. Utiliza estructuras XML, delimitación de roles estrictos...
          </p>
        </div>
        
        <div className="rounded-lg border border-gray-800 bg-zinc-950 p-4 opacity-75">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-200">llm-wiki</h4>
            <span className="rounded bg-gray-500/10 px-2 py-0.5 text-xs text-gray-400">Global Read-Only</span>
          </div>
          <p className="mt-2 text-sm text-gray-400 line-clamp-2">
            Implementa el patrón de base de conocimiento persistente basado en Markdown (Karpathy 'llm-wiki')...
          </p>
        </div>
      </div>

      <WikiViewerModal agentId={agent.id} agentName={agent.name} isOpen={isWikiOpen} onClose={() => setIsWikiOpen(false)} />
    </div>
  );
}
