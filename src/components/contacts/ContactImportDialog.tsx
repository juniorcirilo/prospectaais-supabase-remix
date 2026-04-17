import { useState, useMemo } from "react";
import { Brain, Loader2, ArrowRight, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import CsvUploader from "@/components/broadcasts/CsvUploader";
import { useContacts } from "@/hooks/useContacts";
import { toast } from "sonner";

const CONTACT_FIELDS = [
  { key: "phone", label: "Telefone", required: true },
  { key: "name", label: "Nome", required: false },
  { key: "company", label: "Empresa", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "tags", label: "Tags", required: false },
  { key: "status", label: "Status", required: false },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: Array<{ id: string; name: string }>;
  activeListId?: string | null;
}

export default function ContactImportDialog({ open, onOpenChange, lists, activeListId }: Props) {
  const { importContacts } = useContacts();

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customFieldCols, setCustomFieldCols] = useState<string[]>([]);
  const [targetListId, setTargetListId] = useState<string>(activeListId || "");
  const [importing, setImporting] = useState(false);
  const [aiMapping, setAiMapping] = useState(false);

  const unmappedHeaders = useMemo(() => {
    const mappedCols = new Set(Object.values(mapping));
    return headers.filter(h => !mappedCols.has(h) && !customFieldCols.includes(h));
  }, [headers, mapping, customFieldCols]);

  const handleDataParsed = (h: string[], r: string[][]) => {
    setHeaders(h);
    setRows(r);
    setMapping({});
    setCustomFieldCols([]);
    if (h.length > 0) {
      autoDetectMapping(h);
    }
  };

  const autoDetectMapping = (csvHeaders: string[]) => {
    const m: Record<string, string> = {};
    const lowerHeaders = csvHeaders.map(h => h.toLowerCase().trim());

    const phonePatterns = ["telefone", "phone", "whatsapp", "celular", "fone", "tel", "número", "numero"];
    const namePatterns = ["nome", "name", "contato", "cliente"];
    const companyPatterns = ["empresa", "company", "organização", "organizacao", "org"];
    const cityPatterns = ["cidade", "city", "municipio", "município", "localidade"];
    const tagPatterns = ["tags", "tag", "etiqueta", "label"];
    const statusPatterns = ["status", "situação", "situacao", "estado"];

    const detect = (patterns: string[], field: string) => {
      const idx = lowerHeaders.findIndex(h => patterns.some(p => h.includes(p)));
      if (idx >= 0) m[field] = csvHeaders[idx];
    };

    detect(phonePatterns, "phone");
    detect(namePatterns, "name");
    detect(companyPatterns, "company");
    detect(cityPatterns, "city");
    detect(tagPatterns, "tags");
    detect(statusPatterns, "status");

    setMapping(m);
  };

  const handleAiAutoMap = async () => {
    setAiMapping(true);
    try {
      // Sample data for AI context
      const sampleRows = rows.slice(0, 3).map(r =>
        headers.reduce((obj, h, i) => ({ ...obj, [h]: r[i] || "" }), {} as Record<string, string>)
      );

      const prompt = `Dado estas colunas CSV: ${JSON.stringify(headers)}
Com dados exemplo: ${JSON.stringify(sampleRows)}

Mapeie cada coluna CSV para o campo de contato mais apropriado.
Campos disponíveis: phone (telefone), name (nome), company (empresa), city (cidade), tags, status.
Colunas que não correspondem a nenhum campo devem ser marcadas como "custom_field".

Responda APENAS com um JSON no formato: {"mapping": {"campo_contato": "coluna_csv"}, "custom_fields": ["coluna1", "coluna2"]}`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-column-mapper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ headers, sampleRows }),
      });

      if (!response.ok) throw new Error("Erro na IA");

      const data = await response.json();
      if (data.mapping) setMapping(data.mapping);
      if (data.custom_fields) setCustomFieldCols(data.custom_fields);
      toast.success("Colunas mapeadas pela IA!");
    } catch {
      // Fallback: just use auto-detect
      autoDetectMapping(headers);
      toast.info("IA indisponível, mapeamento automático aplicado");
    } finally {
      setAiMapping(false);
    }
  };

  const setMappingField = (field: string, csvCol: string) => {
    setMapping(prev => {
      const next = { ...prev };
      // Remove previous mapping for this field
      if (csvCol === "__none") {
        delete next[field];
        return next;
      }
      // Remove if another field was using this col
      for (const k in next) {
        if (next[k] === csvCol && k !== field) delete next[k];
      }
      next[field] = csvCol;
      return next;
    });
    // Remove from custom fields if it was there
    setCustomFieldCols(prev => prev.filter(c => c !== csvCol));
  };

  const toggleCustomField = (col: string) => {
    setCustomFieldCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const phoneCol = mapping.phone;
  const canImport = !!phoneCol && rows.length > 0;

  const handleImport = async () => {
    if (!phoneCol) return;
    setImporting(true);
    try {
      const contacts = rows
        .map(row => {
          const getVal = (field: string) => {
            const col = mapping[field];
            if (!col) return "";
            const idx = headers.indexOf(col);
            return idx >= 0 ? (row[idx] || "").trim() : "";
          };

          const phone = getVal("phone").replace(/\D/g, "");
          if (!phone) return null;

          const custom_fields: Record<string, string> = {};
          for (const col of customFieldCols) {
            const idx = headers.indexOf(col);
            if (idx >= 0 && row[idx]?.trim()) {
              custom_fields[col] = row[idx].trim();
            }
          }

          const tagsRaw = getVal("tags");
          const tags = tagsRaw ? tagsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : undefined;

          return {
            phone,
            name: getVal("name") || "Sem nome",
            company: getVal("company") || undefined,
            city: getVal("city") || undefined,
            status: getVal("status") || "novo",
            tags,
            list_id: targetListId || undefined,
            custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined,
          };
        })
        .filter(Boolean) as any[];

      if (contacts.length === 0) {
        toast.error("Nenhum contato válido encontrado");
        return;
      }

      await importContacts.mutateAsync(contacts);
      onOpenChange(false);
      // Reset
      setHeaders([]);
      setRows([]);
      setMapping({});
      setCustomFieldCols([]);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Contatos</DialogTitle>
          <DialogDescription>
            Envie um CSV com qualquer formato de colunas e mapeie para os campos do contato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1: Upload */}
          <CsvUploader onDataParsed={handleDataParsed} />

          {/* Step 2: Column Mapping */}
          {headers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Mapeamento de Colunas</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={handleAiAutoMap}
                  disabled={aiMapping}
                >
                  {aiMapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  {aiMapping ? "Mapeando..." : "IA Auto-mapear"}
                </Button>
              </div>

              <div className="space-y-2.5">
                {CONTACT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-[120px] shrink-0">
                      <span className="text-xs font-medium text-foreground">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[field.key] || "__none"}
                      onValueChange={(v) => setMappingField(field.key, v)}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">
                          <span className="text-muted-foreground">— Não mapear —</span>
                        </SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>
                            {h}
                            {mapping[field.key] === h && <Check className="w-3 h-3 ml-1 inline text-primary" />}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Unmapped columns → custom fields */}
              {unmappedHeaders.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <Label className="text-xs text-muted-foreground">
                    Colunas não mapeadas — ativar como campos customizados:
                  </Label>
                  <div className="space-y-1.5">
                    {unmappedHeaders.map(col => (
                      <div key={col} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                        <span className="text-xs font-medium text-foreground">{col}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {customFieldCols.includes(col) ? "Campo customizado" : "Ignorar"}
                          </span>
                          <Switch
                            checked={customFieldCols.includes(col)}
                            onCheckedChange={() => toggleCustomField(col)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target list */}
              {lists.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <Label className="text-xs">Importar para lista (opcional)</Label>
                  <Select value={targetListId} onValueChange={setTargetListId}>
                    <SelectTrigger className="h-8 mt-1.5">
                      <SelectValue placeholder="Nenhuma lista selecionada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Nenhuma</SelectItem>
                      {lists.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Validation */}
              {!phoneCol && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Mapeie a coluna de telefone para poder importar.
                </div>
              )}

              {/* Summary & Import */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {rows.length} contatos · {Object.keys(mapping).filter(k => mapping[k] && mapping[k] !== "__none").length} campos mapeados
                  {customFieldCols.length > 0 && ` · ${customFieldCols.length} campos customizados`}
                </p>
                <Button
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="gap-2"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {importing ? "Importando..." : `Importar ${rows.length} contatos`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}