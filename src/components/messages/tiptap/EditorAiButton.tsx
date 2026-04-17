import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Wand2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditorAiButtonProps {
  currentContent: string;
  onResult: (newContent: string) => void;
}

type AiMode = null | 'generate' | 'enhance';

export default function EditorAiButton({ currentContent, onResult }: EditorAiButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AiMode>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode(null);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleGenerate = async () => {
    if (mode === 'generate' && !instruction.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message-variations', {
        body: {
          base_text: mode === 'enhance' ? currentContent : instruction,
          instruction: mode === 'enhance' ? instruction || undefined : undefined,
          mode: mode === 'generate' ? 'generate_copy' : 'enhance_copy',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro');
      onResult(data.rewritten);
      toast.success(mode === 'generate' ? 'Copy gerada!' : 'Copy melhorada!');
      setOpen(false);
      setMode(null);
      setInstruction('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-2 right-2 z-10" ref={panelRef}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="h-7 w-7 flex items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Assistente IA"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      )}

      {open && !mode && (
        <div className="bg-card border border-border rounded-lg shadow-lg p-2 w-56 animate-scale-in space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-2 py-1">Assistente IA</p>
          <button
            onClick={() => setMode('generate')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <Wand2 className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-medium text-xs">Gerar copy</p>
              <p className="text-[10px] text-muted-foreground">Criar do zero com variáveis e variações</p>
            </div>
          </button>
          <button
            onClick={() => {
              if (!currentContent.trim()) {
                toast.error('Escreva algo primeiro para melhorar');
                return;
              }
              setMode('enhance');
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <PenLine className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-medium text-xs">Melhorar copy</p>
              <p className="text-[10px] text-muted-foreground">Adicionar variáveis e variações na copy atual</p>
            </div>
          </button>
        </div>
      )}

      {open && mode && (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 w-72 animate-scale-in space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {mode === 'generate' ? <Wand2 className="w-3.5 h-3.5 text-primary" /> : <PenLine className="w-3.5 h-3.5 text-primary" />}
              {mode === 'generate' ? 'Gerar copy' : 'Melhorar copy'}
            </p>
            <button onClick={() => { setMode(null); setInstruction(''); }} className="text-muted-foreground hover:text-foreground text-xs">
              Voltar
            </button>
          </div>

          <Textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder={mode === 'generate'
              ? 'Descreva a copy que deseja...\nEx: Prospecção para donos de academia oferecendo sistema de gestão'
              : 'Instrução adicional (opcional)\nEx: Foque mais em urgência e escassez'
            }
            className="min-h-[80px] text-xs resize-none"
          />

          <Button
            onClick={handleGenerate}
            disabled={loading || (mode === 'generate' && !instruction.trim())}
            size="sm"
            className="w-full gap-2 text-xs"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Gerando...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" />{mode === 'generate' ? 'Gerar' : 'Melhorar'}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
