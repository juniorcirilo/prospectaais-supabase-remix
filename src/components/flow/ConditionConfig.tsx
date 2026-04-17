import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ConditionRule {
  source: string;
  operator: string;
  value: string;
  field_name?: string;
  case_sensitive?: boolean;
}

interface Props {
  config: Record<string, any>;
  set: (key: string, value: any) => void;
  existingFieldNames: string[];
}

function getDefaultRule(): ConditionRule {
  return { source: "last_reply", operator: "contains", value: "", case_sensitive: false };
}

export default function ConditionConfig({ config, set, existingFieldNames }: Props) {
  // Backward compat: migrate old single-condition format to conditions array
  const conditions: ConditionRule[] = config.conditions && Array.isArray(config.conditions)
    ? config.conditions
    : [
        {
          source: config.source || "last_reply",
          operator: config.operator || "contains",
          value: config.value || "",
          field_name: config.field_name || "",
          case_sensitive: !!config.case_sensitive,
        },
      ];

  const logicOperator: "and" | "or" = config.logic_operator || "and";

  const updateConditions = (newConditions: ConditionRule[]) => {
    set("conditions", newConditions);
  };

  const updateRule = (index: number, key: keyof ConditionRule, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: value };
    updateConditions(updated);
  };

  const addRule = () => {
    updateConditions([...conditions, getDefaultRule()]);
  };

  const removeRule = (index: number) => {
    if (conditions.length <= 1) return;
    updateConditions(conditions.filter((_, i) => i !== index));
  };

  return (
    <>
      {conditions.length > 1 && (
        <div>
          <Label className="text-xs">Lógica entre condições</Label>
          <ToggleGroup
            type="single"
            value={logicOperator}
            onValueChange={(v) => { if (v) set("logic_operator", v); }}
            className="justify-start mt-1"
          >
            <ToggleGroupItem value="and" className="h-7 px-3 text-xs">
              E (AND)
            </ToggleGroupItem>
            <ToggleGroupItem value="or" className="h-7 px-3 text-xs">
              OU (OR)
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-[10px] text-muted-foreground mt-1">
            {logicOperator === "and"
              ? "Todas as condições devem ser verdadeiras"
              : "Pelo menos uma condição deve ser verdadeira"}
          </p>
        </div>
      )}

      {conditions.map((rule, idx) => (
        <div key={idx} className="space-y-2 p-2 rounded-md border border-border bg-muted/30 relative">
          {conditions.length > 1 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Condição {idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeRule(idx)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          )}

          <div>
            <Label className="text-xs">Fonte</Label>
            <Select value={rule.source || "last_reply"} onValueChange={(v) => updateRule(idx, "source", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_reply">Última resposta</SelectItem>
                <SelectItem value="tag">Tag do contato</SelectItem>
                <SelectItem value="custom_field">Campo customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Operador</Label>
            <Select value={rule.operator || "contains"} onValueChange={(v) => updateRule(idx, "operator", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="not_contains">Não contém</SelectItem>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rule.source === "custom_field" && (
            <div>
              <Label className="text-xs">Nome do campo</Label>
              {existingFieldNames.length > 0 ? (
                <Select value={rule.field_name || ""} onValueChange={(v) => updateRule(idx, "field_name", v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecione um campo" /></SelectTrigger>
                  <SelectContent>
                    {existingFieldNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={rule.field_name || ""}
                  onChange={(e) => updateRule(idx, "field_name", e.target.value)}
                  placeholder="Ex: funcao, budget"
                  className="h-8"
                />
              )}
            </div>
          )}

          <div>
            <Label className="text-xs">Valor</Label>
            <Input
              value={rule.value || ""}
              onChange={(e) => updateRule(idx, "value", e.target.value)}
              placeholder="Texto para comparar"
              className="h-8"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Case sensitive</Label>
            <Switch
              checked={!!rule.case_sensitive}
              onCheckedChange={(v) => updateRule(idx, "case_sensitive", v)}
            />
          </div>

          {idx < conditions.length - 1 && conditions.length > 1 && (
            <div className="flex justify-center -mb-4 relative z-10">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground uppercase">
                {logicOperator === "and" ? "E" : "OU"}
              </span>
            </div>
          )}
        </div>
      ))}

      <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addRule}>
        <Plus className="w-3 h-3 mr-1" /> Adicionar condição
      </Button>
    </>
  );
}
