import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { docToSpintax } from './serializer';

interface SlashRewriteCommandProps {
  editor: Editor;
  onRewrite: (newContent: string) => void;
}

export default function SlashRewriteCommand({ editor, onRewrite }: SlashRewriteCommandProps) {
  const [visible, setVisible] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const slashPosRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    setInstruction('');
    slashPosRef.current = null;
    editor.commands.focus();
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (visible && event.key === 'Escape') {
        hide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, hide, editor]);

  useEffect(() => {
    const checkForSlash = () => {
      if (!editor || loading) return;

      const { state } = editor;
      const { from } = state.selection;

      if (from < 2) return;
      const textBefore = state.doc.textBetween(from - 2, from);

      if (textBefore === '//') {
        slashPosRef.current = from - 2;

        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.closest('.template-editor')?.getBoundingClientRect();
        if (editorRect) {
          setPosition({
            top: coords.top - editorRect.top - 2,
            left: coords.left - editorRect.left + 16,
          });
        }

        setVisible(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };

    editor.on('update', checkForSlash);
    return () => { editor.off('update', checkForSlash); };
  }, [editor, loading]);

  const handleGenerate = async () => {
    if (loading || slashPosRef.current === null) return;

    let parsedInstruction = instruction.trim();
    const braceMatch = parsedInstruction.match(/\{([^}]+)\}/);
    if (braceMatch) {
      parsedInstruction = braceMatch[1].trim();
    }

    // Get context: text before and after the "//" position
    const fullContent = docToSpintax(editor.getJSON());
    const slashPos = slashPosRef.current;

    // Remove the "//" from the editor
    editor.chain()
      .deleteRange({ from: slashPos, to: slashPos + 2 })
      .run();

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message-variations', {
        body: {
          base_text: fullContent,
          instruction: parsedInstruction || undefined,
          mode: 'inline',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar');

      const generated = data.rewritten || '';
      if (generated) {
        // Parse generated text to convert {{var}} into sendVariable nodes
        const contentNodes: any[] = [];
        const parts = generated.split(/(\{\{[^}]+\}\})/g);
        for (const part of parts) {
          const varMatch = part.match(/^\{\{([^}]+)\}\}$/);
          if (varMatch) {
            contentNodes.push({ type: 'sendVariable', attrs: { name: varMatch[1].trim() } });
          } else if (part) {
            contentNodes.push({ type: 'text', text: part });
          }
        }

        editor.chain()
          .focus()
          .insertContentAt(slashPos, contentNodes)
          .run();
        const newSpintax = docToSpintax(editor.getJSON());
        onRewrite(newSpintax);
        toast.success('Trecho gerado pela IA!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar trecho');
    } finally {
      setLoading(false);
      setVisible(false);
      setInstruction('');
      slashPosRef.current = null;
    }
  };

  if (!visible) return null;

  return (
    <div
      className="absolute z-50 animate-fade-in"
      style={{ top: position.top, left: Math.max(0, position.left - 8) }}
    >
      <div className="flex items-center gap-2 bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[320px]">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <input
          ref={inputRef}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleGenerate();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              hide();
            }
          }}
          placeholder="O que escrever aqui? (Enter para gerar)"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          disabled={loading}
        />
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
        ) : (
          <span className="text-[10px] text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">Enter ↵</span>
        )}
      </div>
    </div>
  );
}
