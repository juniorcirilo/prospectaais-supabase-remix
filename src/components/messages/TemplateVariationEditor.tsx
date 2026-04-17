import React, { useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { VariationNode, SendVariableNode } from './tiptap/extensions';
import { spintaxToHTML, docToSpintax } from './tiptap/serializer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Variable, Shuffle, Plus, X } from 'lucide-react';
import SlashRewriteCommand from './tiptap/SlashRewriteCommand';
import EditorAiButton from './tiptap/EditorAiButton';

const DEFAULT_SEND_VARIABLES = [
  { key: 'nome', label: 'Nome' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'cidade', label: 'Cidade' },
];

interface TemplateVariationEditorProps {
  content: string;
  onChange: (content: string) => void;
  variableValues?: Record<string, string>;
  onVariableChange?: (name: string, value: string) => void;
}

export default function TemplateVariationEditor({ content, onChange, variableValues = {}, onVariableChange }: TemplateVariationEditorProps) {
  const [showCustomVar, setShowCustomVar] = useState(false);
  const [customVarName, setCustomVarName] = useState('');
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: 'Olá {{nome}}, tudo bem? Escreva e selecione trechos para criar variações...',
      }),
      VariationNode,
      SendVariableNode,
    ],
    content: spintaxToHTML(content),
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const spintax = docToSpintax(editor.getJSON());
      onChange(spintax);
    },
  });

  // Sync variable test values into editor storage
  if (editor) {
    (editor.storage as any).sendVariable.testValues = variableValues;
    (editor.storage as any).sendVariable.onTestValueChange = onVariableChange || null;
  }

  // Sync external content changes (e.g. when loading a template for editing)
  // We only sync if the spintax differs to avoid cursor jumps
  const lastExternalContent = useRef(content);
  if (editor && content !== lastExternalContent.current) {
    const currentSpintax = docToSpintax(editor.getJSON());
    if (currentSpintax !== content) {
      isUpdatingRef.current = true;
      editor.commands.setContent(spintaxToHTML(content));
      isUpdatingRef.current = false;
    }
    lastExternalContent.current = content;
  }

  const insertSendVariable = (key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'sendVariable',
      attrs: { name: key },
    }).run();
  };

  const createVariationFromSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    if (!text.trim()) return;

    editor.chain().focus()
      .deleteSelection()
      .insertContent({
        type: 'variation',
        attrs: { options: [text.trim()] },
      })
      .run();
  };

  const addCustomVariable = () => {
    if (!customVarName.trim()) return;
    insertSendVariable(customVarName.trim().toLowerCase().replace(/\s+/g, '_'));
    setCustomVarName('');
    setShowCustomVar(false);
  };

  const handleAiRewrite = useCallback((newContent: string) => {
    onChange(newContent);
  }, [onChange]);

  const handleAiFullRewrite = useCallback((newContent: string) => {
    if (!editor) return;
    isUpdatingRef.current = true;
    editor.commands.setContent(spintaxToHTML(newContent));
    isUpdatingRef.current = false;
    onChange(newContent);
  }, [editor, onChange]);

  return (
    <div className="space-y-4">
      {/* Send Variables */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Variable className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variáveis de envio</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_SEND_VARIABLES.map(v => (
            <button
              key={v.key}
              onClick={() => insertSendVariable(v.key)}
              className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-lg text-xs font-mono text-primary hover:bg-primary/20 transition-colors"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
          {showCustomVar ? (
            <div className="flex items-center gap-1">
              <Input
                value={customVarName}
                onChange={e => setCustomVarName(e.target.value)}
                placeholder="nome_campo"
                className="h-7 w-32 text-xs font-mono"
                onKeyDown={e => {
                  if (e.key === 'Enter') addCustomVariable();
                  if (e.key === 'Escape') setShowCustomVar(false);
                }}
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={addCustomVariable}><Plus className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setShowCustomVar(false)}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomVar(true)}
              className="px-2.5 py-1 border border-dashed border-muted-foreground/30 rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Plus className="w-3 h-3 inline mr-1" />Customizar
            </button>
          )}
        </div>
      </div>

      {/* TipTap Editor */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Mensagem</label>
        <p className="text-xs text-muted-foreground">Selecione um trecho do texto para criar blocos de variação</p>

        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor, state }) => {
              const { from, to } = state.selection;
              if (from === to) return false;
              const text = state.doc.textBetween(from, to);
              return text.trim().length > 0 && !editor.isActive('variation') && !editor.isActive('sendVariable');
            }}
          >
            <Button size="sm" className="gap-1.5 shadow-lg text-xs h-8" onClick={createVariationFromSelection}>
              <Shuffle className="w-3.5 h-3.5" />
              Criar variação
            </Button>
          </BubbleMenu>
        )}

        <div className="template-editor relative rounded-md border border-input bg-background px-3 py-2 min-h-[180px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror_p]:my-1 text-sm"
          />
          {editor && (
            <SlashRewriteCommand editor={editor} onRewrite={handleAiRewrite} />
          )}
          <EditorAiButton
            currentContent={docToSpintax(editor?.getJSON() || { type: 'doc', content: [] })}
            onResult={handleAiFullRewrite}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          💡 Digite <code className="bg-muted px-1 rounded text-[10px]">//</code> para gerar trecho com IA
        </p>
      </div>
    </div>
  );
}
