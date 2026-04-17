import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Plus, Trash2, X, Sparkles, Loader2, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Variation Node View ─────────────────────────────────────────────────────

function VariationNodeViewComponent({ node, updateAttributes, deleteNode }: any) {
  const [open, setOpen] = useState(false);
  const [newOpt, setNewOpt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const options: string[] = node.attrs.options || [];

  const addOption = () => {
    if (!newOpt.trim()) return;
    updateAttributes({ options: [...options, newOpt.trim()] });
    setNewOpt('');
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) { deleteNode(); return; }
    updateAttributes({ options: options.filter((_: string, i: number) => i !== index) });
  };

  const reorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newOptions = [...options];
    const [moved] = newOptions.splice(fromIdx, 1);
    newOptions.splice(toIdx, 0, moved);
    updateAttributes({ options: newOptions });
  };

  const generateAi = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message-variations', {
        body: { base_text: options[0], mode: 'fragment', count: 5 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      const newOptions = [...new Set([...options, ...(data.variations || [])])];
      updateAttributes({ options: newOptions });
      toast.success(`${data.variations?.length || 0} variações geradas!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <NodeViewWrapper as="span" className="inline">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span
            className="variation-chip"
            contentEditable={false}
          >
            <Shuffle className="w-3 h-3 shrink-0" />
            <span>{options[0]}</span>
            {options.length > 1 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5 h-4">{options.length}</Badge>
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 space-y-3" align="start" onOpenAutoFocus={e => e.preventDefault()}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Variações</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={generateAi} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-500" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={deleteNode}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">⬆ A primeira variação é usada no preview e áudio. Arraste para reordenar.</p>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {options.map((opt: string, i: number) => (
              <div
                key={`${i}-${opt}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) reorder(dragIdx, i);
                  setDragIdx(null);
                  setDragOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`flex items-center gap-1.5 group rounded-md transition-all duration-150 ${
                  dragOverIdx === i ? 'border-t-2 border-primary' : ''
                } ${dragIdx === i ? 'opacity-40' : ''} ${i === 0 ? 'bg-primary/10 border border-primary/20' : ''}`}
              >
                <span className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                {i === 0 && <span className="text-[9px] font-bold text-primary shrink-0">1º</span>}
                <span className="flex-1 text-sm text-foreground rounded px-1.5 py-1 truncate">{opt}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => removeOption(i)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newOpt}
              onChange={e => setNewOpt(e.target.value)}
              placeholder="Nova variação..."
              className="h-8 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
            />
            <Button size="sm" className="h-8 px-2" onClick={addOption} disabled={!newOpt.trim()}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

// ─── Send Variable Node View ─────────────────────────────────────────────────

function SendVariableNodeViewComponent({ node, editor }: any) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const varName = node.attrs.name;

  // Read current test value from editor storage
  const testValues: Record<string, string> = editor?.storage?.sendVariable?.testValues || {};
  const currentValue = testValues[varName] || '';

  const handleOpen = () => {
    setInputValue(currentValue);
    setOpen(true);
  };

  const handleSave = () => {
    const cb = editor?.storage?.sendVariable?.onTestValueChange;
    if (cb) cb(varName, inputValue);
    setOpen(false);
  };

  return (
    <NodeViewWrapper as="span" className="inline">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span
            className="send-variable-chip"
            contentEditable={false}
            onClick={handleOpen}
            style={{ cursor: 'pointer' }}
          >
            {currentValue
              ? <><span className="opacity-50 text-[9px]">{varName}:</span> {currentValue}</>
              : `{{${varName}}}`
            }
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" align="start" onOpenAutoFocus={e => e.preventDefault()}>
          <p className="text-xs font-medium text-foreground">Valor de teste para <code className="bg-muted px-1 rounded text-[10px]">{`{{${varName}}}`}</code></p>
          <p className="text-[10px] text-muted-foreground">Usado no preview e na geração de áudio</p>
          <div className="flex gap-1.5">
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={`Ex: João, Empresa X...`}
              className="h-8 text-sm flex-1"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSave}>OK</Button>
          </div>
          {currentValue && (
            <button
              className="text-[10px] text-destructive hover:underline"
              onClick={() => {
                const cb = editor?.storage?.sendVariable?.onTestValueChange;
                if (cb) cb(varName, '');
                setOpen(false);
              }}
            >
              Limpar valor
            </button>
          )}
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

// ─── Variation Extension ─────────────────────────────────────────────────────

export const VariationNode = Node.create({
  name: 'variation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      options: {
        default: [],
        parseHTML: (el: HTMLElement) => {
          try { return JSON.parse(el.getAttribute('data-options') || '[]'); }
          catch { return []; }
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variation]' }];
  },

  renderHTML({ node }) {
    return ['span', mergeAttributes({
      'data-variation': '',
      'data-options': JSON.stringify(node.attrs.options),
    }), node.attrs.options[0] || ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariationNodeViewComponent);
  },
});

// ─── Send Variable Extension ─────────────────────────────────────────────────

export const SendVariableNode = Node.create({
  name: 'sendVariable',
  group: 'inline',
  inline: true,
  atom: true,

  addStorage() {
    return {
      testValues: {} as Record<string, string>,
      onTestValueChange: null as ((name: string, value: string) => void) | null,
    };
  },

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-name') || '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-send-variable]' }];
  },

  renderHTML({ node }) {
    return ['span', mergeAttributes({
      'data-send-variable': '',
      'data-name': node.attrs.name,
    }), `{{${node.attrs.name}}}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SendVariableNodeViewComponent);
  },
});
