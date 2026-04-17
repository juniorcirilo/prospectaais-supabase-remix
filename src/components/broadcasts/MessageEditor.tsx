import React, { useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Variable } from 'lucide-react';

interface MessageEditorProps {
  template: string;
  customFields: string[];
  onTemplateChange: (template: string) => void;
}

const MessageEditor: React.FC<MessageEditorProps> = ({ template, customFields, onTemplateChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (field: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    const variable = `{{${field}}}`;
    onTemplateChange(template.substring(0, start) + variable + template.substring(end));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + variable.length, start + variable.length); }, 0);
  };


  return (
    <div className="space-y-4">
      {customFields.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Variable className="w-4 h-4 text-primary" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variáveis disponíveis</span></div>
          <div className="flex flex-wrap gap-1.5">
            {customFields.map(f => <button key={f} onClick={() => insertVariable(f)} className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-lg text-xs font-mono text-primary hover:bg-primary/20 transition-colors">{`{{${f}}}`}</button>)}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Mensagem</label>
        <Textarea ref={textareaRef} value={template} onChange={e => onTemplateChange(e.target.value)}
          placeholder={`Olá {{nome}}, tudo bem?\n\nEscreva sua mensagem usando variáveis entre {{ }}`} className="min-h-[160px] font-mono text-sm bg-background resize-y" />
      </div>
    </div>
  );
};

export default MessageEditor;