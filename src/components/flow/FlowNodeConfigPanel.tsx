import { type Node } from "@xyflow/react";
import { useMemo, useState } from "react";
import { X, Trash2, Info, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBroadcasts } from "@/hooks/useBroadcasts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ConditionConfig from "./ConditionConfig";

interface Props {
  node: Node;
  allNodes?: Node[];
  onUpdate: (nodeId: string, config: Record<string, any>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function FlowNodeConfigPanel({ node, allNodes, onUpdate, onDelete, onClose }: Props) {
  const nodeType = (node.data as any).type || "message";
  const config: Record<string, any> = (node.data as any).config || {};
  const flowId = (node.data as any).flowId as string | undefined;
  const { campaigns } = useBroadcasts();
  const queryClient = useQueryClient();

  // Extract all custom field names used across all nodes in the flow
  const existingFieldNames = useMemo(() => {
    if (!allNodes) return [];
    const names = new Set<string>();
    allNodes.forEach((n) => {
      const c = (n.data as any).config || {};
      if (c.field_name && typeof c.field_name === "string") {
        const nType = (n.data as any).type;
        const isRelevant =
          (nType === "action" && (c.action_type === "set_custom_field" || c.action_type === "update_field")) ||
          (nType === "condition" && c.source === "custom_field");
        if (isRelevant) names.add(c.field_name);
      }
    });
    return Array.from(names).sort();
  }, [allNodes]);

  const [fieldNameOpen, setFieldNameOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");

  const set = (key: string, value: any) => {
    onUpdate(node.id, { ...config, [key]: value });
  };

  return (
    <div className="w-[300px] border-l bg-background p-4 overflow-y-auto shrink-0 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Configurar Card</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Common label */}
      <div>
        <Label className="text-xs">Rótulo</Label>
        <Input
          value={config.label || ""}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Nome do card"
          className="h-8"
        />
      </div>

      {/* Type-specific fields */}
      {nodeType === "message" && (
        <>
          <div>
            <Label className="text-xs">Tipo de conteúdo</Label>
            <Select value={config.content_type || "text"} onValueChange={(v) => set("content_type", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="audio">Áudio</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Conteúdo da mensagem</Label>
            <Textarea
              value={config.content || ""}
              onChange={(e) => set("content", e.target.value)}
              placeholder="Texto com {{variáveis}} e {spintax|opções}"
              rows={4}
            />
          </div>
          {config.content_type && config.content_type !== "text" && (
            <div>
              <Label className="text-xs">URL da mídia</Label>
              <Input
                value={config.media_url || ""}
                onChange={(e) => set("media_url", e.target.value)}
                placeholder="https://..."
                className="h-8"
              />
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="text-xs">Aguardar resposta</Label>
              <p className="text-[10px] text-muted-foreground">Pausa o fluxo até o contato responder</p>
            </div>
            <Switch
              checked={!!config.wait_for_reply}
              onCheckedChange={(v) => set("wait_for_reply", v)}
            />
          </div>
          {config.wait_for_reply && (
            <div>
              <Label className="text-xs">Timeout (horas)</Label>
              <Input
                type="number"
                value={config.wait_timeout_hours || 24}
                onChange={(e) => set("wait_timeout_hours", Number(e.target.value))}
                placeholder="24"
                className="h-8"
                min={1}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se não responder nesse tempo, segue pela saída "timeout"
              </p>
            </div>
          )}
        </>
      )}

      {nodeType === "delay" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Duração</Label>
              <Input
                type="number"
                value={config.duration || ""}
                onChange={(e) => set("duration", Number(e.target.value))}
                placeholder="5"
                className="h-8"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Unidade</Label>
              <Select value={config.unit || "minutes"} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Modo</Label>
            <Select value={config.wait_mode || "fixed"} onValueChange={(v) => set("wait_mode", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Tempo fixo</SelectItem>
                <SelectItem value="reply_or_timeout">Aguardar resposta (ou timeout)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {nodeType === "condition" && (
        <ConditionConfig config={config} set={set} existingFieldNames={existingFieldNames} />
      )}

      {nodeType === "ai" && (
        <>
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={config.model || "gemini-2.5-flash"} onValueChange={(v) => set("model", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                <SelectItem value="gpt-5">GPT-5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">System Prompt</Label>
            <Textarea
              value={config.system_prompt || ""}
              onChange={(e) => set("system_prompt", e.target.value)}
              placeholder="Instruções para a IA..."
              rows={4}
            />
          </div>
          <div>
            <Label className="text-xs">Contexto enviado</Label>
            <Select value={config.context_mode || "last"} onValueChange={(v) => set("context_mode", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last">Última mensagem</SelectItem>
                <SelectItem value="last_5">Últimas 5 mensagens</SelectItem>
                <SelectItem value="full">Conversa completa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Modo de saída</Label>
            <Select value={config.output_mode || "send"} onValueChange={(v) => set("output_mode", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="send">Enviar ao contato</SelectItem>
                <SelectItem value="variable">Salvar em variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fallback (se erro)</Label>
            <Input
              value={config.fallback || ""}
              onChange={(e) => set("fallback", e.target.value)}
              placeholder="Mensagem padrão em caso de erro"
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="text-xs">Aguardar resposta</Label>
              <p className="text-[10px] text-muted-foreground">Pausa o fluxo até o contato responder</p>
            </div>
            <Switch
              checked={!!config.wait_for_reply}
              onCheckedChange={(v) => set("wait_for_reply", v)}
            />
          </div>
          {config.wait_for_reply && (
            <div>
              <Label className="text-xs">Timeout (horas)</Label>
              <Input
                type="number"
                value={config.wait_timeout_hours || 24}
                onChange={(e) => set("wait_timeout_hours", Number(e.target.value))}
                placeholder="24"
                className="h-8"
                min={1}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se não responder nesse tempo, segue pela saída "timeout"
              </p>
            </div>
          )}
        </>
      )}

      {nodeType === "action" && (
        <>
          <div>
            <Label className="text-xs">Ação</Label>
            <Select value={config.action_type || "add_tag"} onValueChange={(v) => set("action_type", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add_tag">Adicionar tag</SelectItem>
                <SelectItem value="remove_tag">Remover tag</SelectItem>
                <SelectItem value="set_custom_field">Salvar no contato</SelectItem>
                <SelectItem value="update_field">Salvar em variável</SelectItem>
                <SelectItem value="move_flow">Mover para outro fluxo</SelectItem>
                <SelectItem value="end_flow">Encerrar fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(config.action_type === "add_tag" || config.action_type === "remove_tag") && (
            <div>
              <Label className="text-xs">Tag</Label>
              <Input
                value={config.tag || ""}
                onChange={(e) => set("tag", e.target.value)}
                placeholder="Nome da tag"
                className="h-8"
              />
            </div>
          )}
          {config.action_type === "set_custom_field" && (
            <>
              <div>
                <Label className="text-xs">Nome do campo</Label>
                <div className="flex gap-1.5">
                  {existingFieldNames.length > 0 ? (
                    <Select value={config.field_name || ""} onValueChange={(v) => set("field_name", v)}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Selecione um campo" /></SelectTrigger>
                      <SelectContent>
                        {existingFieldNames.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="flex-1 text-xs text-muted-foreground flex items-center">Nenhum campo criado</p>
                  )}
                  <Popover open={fieldNameOpen} onOpenChange={(open) => { setFieldNameOpen(open); if (!open) setNewFieldName(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-3 space-y-2" align="end">
                      <p className="text-xs font-medium">Novo campo</p>
                      <Input
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        placeholder="Ex: funcao, budget"
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newFieldName.trim()) {
                            const trimmed = newFieldName.trim();
                            if (existingFieldNames.includes(trimmed)) {
                              set("field_name", trimmed);
                              setNewFieldName("");
                              setFieldNameOpen(false);
                              return;
                            }
                            set("field_name", trimmed);
                            setNewFieldName("");
                            setFieldNameOpen(false);
                          }
                        }}
                      />
                      {existingFieldNames.includes(newFieldName.trim()) && newFieldName.trim() && (
                        <p className="text-[10px] text-amber-600">Já existe — será selecionado</p>
                      )}
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={!newFieldName.trim()}
                        onClick={() => {
                          set("field_name", newFieldName.trim());
                          setNewFieldName("");
                          setFieldNameOpen(false);
                        }}
                      >
                        <Check className="w-3 h-3 mr-1" /> Criar
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte do valor</Label>
                <Select value={config.value_source || "manual"} onValueChange={(v) => set("value_source", v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Valor fixo</SelectItem>
                    <SelectItem value="last_reply">Última resposta</SelectItem>
                    <SelectItem value="ai_response">Resposta da IA</SelectItem>
                    <SelectItem value="variable">Variável do fluxo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.value_source === "variable" && (
                <div>
                  <Label className="text-xs">Nome da variável</Label>
                  <Input
                    value={config.field_value || ""}
                    onChange={(e) => set("field_value", e.target.value)}
                    placeholder="Ex: resposta_ia, etapa"
                    className="h-8"
                  />
                </div>
              )}
              {(!config.value_source || config.value_source === "manual") && (
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={config.field_value || ""}
                    onChange={(e) => set("field_value", e.target.value)}
                    placeholder="Ex: auxiliar, 3000"
                    className="h-8"
                  />
                </div>
              )}
              {(config.value_source === "last_reply" || config.value_source === "ai_response") && (
                <div className="p-2 bg-muted/50 border border-border rounded-lg">
                  <p className="text-[10px] text-muted-foreground">
                    {config.value_source === "last_reply"
                      ? "Será salvo o conteúdo da última mensagem recebida do contato."
                      : "Será salvo o conteúdo da última resposta gerada pela IA."}
                  </p>
                </div>
              )}
              <div className="p-2 bg-muted/50 border border-border rounded-lg">
                <p className="text-[10px] text-muted-foreground">
                  Salva o valor no cadastro do contato (persistente).
                </p>
              </div>
            </>
          )}
          {config.action_type === "update_field" && (
            <>
              <div>
                <Label className="text-xs">Nome da variável</Label>
                <div className="flex gap-1.5">
                  {existingFieldNames.length > 0 ? (
                    <Select value={config.field_name || ""} onValueChange={(v) => set("field_name", v)}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Selecione uma variável" /></SelectTrigger>
                      <SelectContent>
                        {existingFieldNames.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="flex-1 text-xs text-muted-foreground flex items-center">Nenhuma variável criada</p>
                  )}
                  <Popover open={fieldNameOpen} onOpenChange={(open) => { setFieldNameOpen(open); if (!open) setNewFieldName(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-3 space-y-2" align="end">
                      <p className="text-xs font-medium">Nova variável</p>
                      <Input
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        placeholder="Ex: resposta_ia, etapa"
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newFieldName.trim()) {
                            set("field_name", newFieldName.trim());
                            setNewFieldName("");
                            setFieldNameOpen(false);
                          }
                        }}
                      />
                      {existingFieldNames.includes(newFieldName.trim()) && newFieldName.trim() && (
                        <p className="text-[10px] text-amber-600">Já existe — será selecionado</p>
                      )}
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={!newFieldName.trim()}
                        onClick={() => {
                          set("field_name", newFieldName.trim());
                          setNewFieldName("");
                          setFieldNameOpen(false);
                        }}
                      >
                        <Check className="w-3 h-3 mr-1" /> Criar
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte do valor</Label>
                <Select value={config.value_source || "manual"} onValueChange={(v) => set("value_source", v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Valor fixo</SelectItem>
                    <SelectItem value="last_reply">Última resposta</SelectItem>
                    <SelectItem value="ai_response">Resposta da IA</SelectItem>
                    <SelectItem value="variable">Variável do fluxo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.value_source === "variable" && (
                <div>
                  <Label className="text-xs">Nome da variável</Label>
                  <Input
                    value={config.field_value || ""}
                    onChange={(e) => set("field_value", e.target.value)}
                    placeholder="Ex: resposta_ia, etapa"
                    className="h-8"
                  />
                </div>
              )}
              {(!config.value_source || config.value_source === "manual") && (
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={config.field_value || ""}
                    onChange={(e) => set("field_value", e.target.value)}
                    placeholder="Valor"
                    className="h-8"
                  />
                </div>
              )}
              {(config.value_source === "last_reply" || config.value_source === "ai_response") && (
                <div className="p-2 bg-muted/50 border border-border rounded-lg">
                  <p className="text-[10px] text-muted-foreground">
                    {config.value_source === "last_reply"
                      ? "Será salvo o conteúdo da última mensagem recebida do contato."
                      : "Será salvo o conteúdo da última resposta gerada pela IA."}
                  </p>
                </div>
              )}
              <div className="p-2 bg-muted/50 border border-border rounded-lg">
                <p className="text-[10px] text-muted-foreground">
                  Salva o valor apenas durante esta execução do fluxo.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {nodeType === "switch" && (
        <>
          <div>
            <Label className="text-xs">Fonte do valor</Label>
            <Select value={config.source || "last_reply"} onValueChange={(v) => set("source", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_reply">Última resposta</SelectItem>
                <SelectItem value="tag">Tag do contato</SelectItem>
                <SelectItem value="custom_field">Campo customizado</SelectItem>
                <SelectItem value="variable">Variável do fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.source === "custom_field" && (
            <div>
              <Label className="text-xs">Nome do campo</Label>
              {existingFieldNames.length > 0 ? (
                <Select value={config.field_name || ""} onValueChange={(v) => set("field_name", v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecione um campo" /></SelectTrigger>
                  <SelectContent>
                    {existingFieldNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={config.field_name || ""}
                  onChange={(e) => set("field_name", e.target.value)}
                  placeholder="Ex: funcao, budget"
                  className="h-8"
                />
              )}
            </div>
          )}

          {config.source === "variable" && (
            <div>
              <Label className="text-xs">Nome da variável</Label>
              {existingFieldNames.length > 0 ? (
                <Select value={config.field_name || ""} onValueChange={(v) => set("field_name", v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecione uma variável" /></SelectTrigger>
                  <SelectContent>
                    {existingFieldNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={config.field_name || ""}
                  onChange={(e) => set("field_name", e.target.value)}
                  placeholder="Ex: resposta_ia, etapa"
                  className="h-8"
                />
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Modo de comparação</Label>
            <Select value={config.match_mode || "exact"} onValueChange={(v) => set("match_mode", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exato</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Case sensitive</Label>
            <Switch
              checked={!!config.case_sensitive}
              onCheckedChange={(v) => set("case_sensitive", v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Casos</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  const cases = config.cases || [{ value: "Caso 1" }, { value: "Caso 2" }];
                  set("cases", [...cases, { value: `Caso ${cases.length + 1}` }]);
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {(config.cases || [{ value: "Caso 1" }, { value: "Caso 2" }]).map((c: { value: string }, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-teal-500 shrink-0" />
                <Input
                  value={c.value}
                  onChange={(e) => {
                    const cases = [...(config.cases || [{ value: "Caso 1" }, { value: "Caso 2" }])];
                    cases[i] = { value: e.target.value };
                    set("cases", cases);
                  }}
                  placeholder={`Valor do caso ${i + 1}`}
                  className="h-7 text-xs"
                />
                {(config.cases || []).length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      const cases = [...(config.cases || [])];
                      cases.splice(i, 1);
                      set("cases", cases);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-1.5 opacity-60">
              <div className="w-3 h-3 rounded-full bg-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Default (nenhum caso correspondeu)</span>
            </div>
          </div>
        </>
      )}

      {nodeType === "trigger" && (
        <>
          <div>
            <Label className="text-xs">Tipo de gatilho</Label>
            <Select value={config.trigger_type || "message_received"} onValueChange={(v) => set("trigger_type", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message_received">Mensagem recebida</SelectItem>
                <SelectItem value="keyword">Palavra-chave</SelectItem>
                <SelectItem value="after_campaign">Resposta de campanha</SelectItem>
                <SelectItem value="followup">Follow-up (programático)</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.trigger_type === "keyword" && (
            <>
              <div>
                <Label className="text-xs">Palavra-chave</Label>
                <Input
                  value={config.keyword || ""}
                  onChange={(e) => set("keyword", e.target.value)}
                  placeholder="Ex: quero saber mais"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Modo de comparação</Label>
                <Select value={config.match_mode || "contains"} onValueChange={(v) => set("match_mode", v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="exact">Exato</SelectItem>
                    <SelectItem value="starts_with">Começa com</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Test mode - available for message_received and keyword triggers */}
          {(config.trigger_type === "message_received" || config.trigger_type === "keyword" || !config.trigger_type) && (
            <>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <Label className="text-xs">Modo de teste</Label>
                  <p className="text-[10px] text-muted-foreground">Só dispara para um número específico</p>
                </div>
                <Switch
                  checked={!!config.test_mode}
                  onCheckedChange={(v) => set("test_mode", v)}
                />
              </div>
              {config.test_mode && (
                <div>
                  <Label className="text-xs">Número de teste</Label>
                  <Input
                    value={config.test_phone || ""}
                    onChange={(e) => set("test_phone", e.target.value)}
                    placeholder="5511999999999"
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Apenas mensagens deste número irão ativar o fluxo
                  </p>
                </div>
              )}
            </>
          )}

          {config.trigger_type === "followup" && (
            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Este fluxo será acionado programaticamente pelo sistema de follow-up. 
                  Não é ativado por mensagens de webhook — será invocado diretamente pelo motor de follow-up.
                </p>
              </div>
            </div>
          )}

          {config.trigger_type === "after_campaign" && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Este fluxo será ativado quando um lead responder a uma campanha vinculada.
                  </p>
                </div>
              </div>

              {/* Link campaign */}
              <div>
                <Label className="text-xs">Vincular campanha</Label>
                <Select
                  value=""
                  onValueChange={async (campaignId) => {
                    const { error } = await supabase
                      .from("broadcast_campaigns")
                      .update({ flow_id: flowId } as any)
                      .eq("id", campaignId);
                    if (error) {
                      toast.error("Erro ao vincular campanha");
                    } else {
                      toast.success("Campanha vinculada!");
                      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
                    }
                  }}
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
                  <SelectContent>
                    {campaigns
                      .filter((c: any) => !c.flow_id)
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.total_recipients} dest.)
                        </SelectItem>
                      ))}
                    {campaigns.filter((c: any) => !c.flow_id).length === 0 && (
                      <SelectItem value="__none" disabled>Nenhuma campanha disponível</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Linked campaigns */}
              {(() => {
                const linkedCampaigns = campaigns.filter((c: any) => c.flow_id === flowId);
                if (linkedCampaigns.length > 0) {
                  return (
                    <div className="space-y-1">
                      <Label className="text-xs">Campanhas vinculadas</Label>
                      {linkedCampaigns.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-background rounded border border-border">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{c.name}</span>
                            <span className="text-muted-foreground">({c.total_recipients} dest.)</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={async () => {
                              const { error } = await supabase
                                .from("broadcast_campaigns")
                                .update({ flow_id: null } as any)
                                .eq("id", c.id);
                              if (!error) {
                                toast.success("Campanha desvinculada");
                                queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
                              }
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <p className="text-xs text-amber-500">Nenhuma campanha vinculada a este fluxo ainda.</p>
                );
              })()}

              <div>
                <Label className="text-xs">Delay antes de ativar (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={config.delay_after || ""}
                    onChange={(e) => set("delay_after", Number(e.target.value))}
                    placeholder="0"
                    className="h-8 flex-1"
                  />
                  <Select value={config.delay_unit || "minutes"} onValueChange={(v) => set("delay_unit", v)}>
                    <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Min</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {(config.trigger_type === "message_received" || !config.trigger_type) && (
            <div>
              <Label className="text-xs">Filtro (opcional)</Label>
              <Input
                value={config.filter_keyword || ""}
                onChange={(e) => set("filter_keyword", e.target.value)}
                placeholder="Qualquer mensagem (vazio = todas)"
                className="h-8"
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={config.description || ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ponto de entrada do fluxo"
              rows={2}
            />
          </div>
        </>
      )}

      {/* Delete */}
      {(
        <Button
          variant="destructive"
          size="sm"
          className="w-full mt-4"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remover Card
        </Button>
      )}
    </div>
  );
}
