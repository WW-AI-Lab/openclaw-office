import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAdapter } from "@/gateway/adapter-provider";

interface WikiViewerModalProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface WikiFile {
  name: string;
  content: string;
}

export function WikiViewerModal({ agentId, agentName, isOpen, onClose }: WikiViewerModalProps) {
  const [files, setFiles] = useState<WikiFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadFiles = async () => {
      if (!isOpen) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const adapter = getAdapter();
        
        // Use standard File API from OpenClaw (via agentsFilesList and agentsFilesGet)
        const fileListResult = await adapter.agentsFilesList(agentId);
        
        // Filter only markdown files based on AgentFilesListResult structure
        const mdFiles = (fileListResult.files || []).filter((f) => f.name.endsWith('.md'));
        
        if (mdFiles.length === 0) {
           if (mounted) {
             setFiles([{ name: "Info.md", content: "No se encontraron archivos Markdown en el workspace de este agente."}]);
             setActiveFileName("Info.md");
             setIsLoading(false);
           }
           return;
        }

        const loadedFiles: WikiFile[] = [];
        
        // Fetch content for each md file
        for (const fileInfo of mdFiles) {
          try {
            const result = await adapter.agentsFilesGet(agentId, fileInfo.name);
            loadedFiles.push({ name: fileInfo.name, content: result.file.content || "*Vacío*" });
          } catch (e) {
            console.warn(`Failed to read ${fileInfo.name}`, e);
          }
        }
        
        if (mounted) {
          loadedFiles.sort((a, b) => {
            // Prioritize standard files
            if (a.name === "index.md" || a.name === "IDENTITY.md") return -1;
            if (b.name === "index.md" || b.name === "IDENTITY.md") return 1;
            return a.name.localeCompare(b.name);
          });
          setFiles(loadedFiles);
          setActiveFileName(loadedFiles[0]?.name || null);
        }
      } catch (err: any) {
        console.error("Wiki load error:", err);
        if (mounted) {
          setError(err.message || "Error desconocido al intentar leer los archivos del agente.");
          setFiles([{ name: "Error.md", content: `# Error de Conexión\n\nNo se pudo leer el disco duro del agente \`${agentId}\`.\n\n**Detalle:** ${err.message}` }]);
          setActiveFileName("Error.md");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadFiles();
    
    return () => {
      mounted = false;
    };
  }, [isOpen, agentId]);

  const activeFile = useMemo(() => files.find(f => f.name === activeFileName) || null, [files, activeFileName]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[85vh] p-0 flex flex-col bg-zinc-950 border border-gray-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-800 px-6 py-4">
          <DialogTitle className="text-xl font-bold text-gray-200">
            Wiki Explorer: {agentName}
          </DialogTitle>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-md w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-800 bg-zinc-900/50 overflow-y-auto flex flex-col">
            <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between border-b border-gray-800/50">
              <span>Local Files</span>
              {isLoading && <span className="animate-pulse text-yellow-500">Syncing...</span>}
            </div>
            
            <div className="flex flex-col gap-1 p-2">
              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setActiveFileName(file.name)}
                  className={`text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    activeFileName === file.name 
                      ? "bg-purple-600/20 text-purple-400 font-medium border border-purple-500/20" 
                      : "text-gray-400 hover:bg-zinc-800 hover:text-gray-200 border border-transparent"
                  }`}
                >
                  <span className="text-gray-500">📄</span> 
                  <span className="truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-zinc-950">
            <div className="prose prose-invert prose-purple max-w-4xl mx-auto">
              {isLoading && files.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Leyendo disco duro del agente...
                </div>
              ) : activeFile ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeFile.content}
                </ReactMarkdown>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Selecciona un documento para visualizar.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
