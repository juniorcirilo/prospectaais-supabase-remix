import { useMemo, useState } from "react";
import {
  MessageSquare, Mail, Lock, ShieldCheck, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, ListPlus, Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContacts } from "@/hooks/useContacts";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/lib/phoneUtils";
import { toast } from "sonner";

interface Contact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  city?: string;
  title?: string;
  whatsapp_site?: string;
  [key: string]: any;
}

interface Props {
  contacts: Contact[];
  searchName: string;
}

interface ValidationResult {
  phone: string;
  originalPhone: string;
  index: number;
  exists: boolean;
  jid: string | null;
}

interface UpsertLeadContactResult {
  id?: string;
  is_new?: boolean;
  skipped?: boolean;
}

const LEAD_SEARCH_TAGS = ["lead-search", "whatsapp-validated"] as const;

const buildContactCustomFields = (contact: Contact) => ({
  email: contact.email || "",
  title: contact.title || "",
  linkedin: contact.linkedin_url || "",
});

const normalizeCustomFieldsRecord = (value: unknown): Record<string, any> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return {};
};

const isBlankText = (value?: string | null): boolean => !value || !value.trim();

const parseWaMe = (value: string): string => {
  if (!value) return "";
  const match = value.match(/wa\.me\/(\d+)/);
  return match ? match[1] : value;
};

const normalizePhone = (value: string): string => value.replace(/\D/g, "");

const getBestPhone = (contact: Contact): string => {
  const candidates = [contact.whatsapp_site, contact.phone, contact.company_phone];

  for (const raw of candidates) {
    const parsed = parseWaMe((raw || "").trim());
    const normalized = normalizeBrazilianPhone(parsed);
    if (normalized) return normalized;
  }

  return "";
};

const getContactQuality = (contact: Contact): number => {
  let score = 0;

  if (contact.name?.trim() && contact.name !== "Sem nome") score += 3;
  if (contact.title?.trim()) score += 2;
  if (contact.email?.trim()) score += 2;
  if (contact.linkedin_url?.trim()) score += 1;
  if ((contact.company || contact.organization_name || "").trim()) score += 1;

  return score;
};

const dedupeContactsByPhone = (items: Contact[]): Contact[] => {
  const byPhone = new Map<string, Contact>();

  for (const contact of items) {
    const normalizedPhone = normalizePhone(getBestPhone(contact));
    if (!normalizedPhone) continue;

    const current = byPhone.get(normalizedPhone);
    if (!current || getContactQuality(contact) > getContactQuality(current)) {
      byPhone.set(normalizedPhone, contact);
    }
  }

  return Array.from(byPhone.values());
};

export default function GenerateListDialog({ contacts, searchName }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [listName, setListName] = useState(searchName || "");
  const [selectedListId, setSelectedListId] = useState<string>("new");
  const [instanceId, setInstanceId] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [showInvalid, setShowInvalid] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationDone, setValidationDone] = useState(false);

  const { lists, addList } = useContacts();
  const { instances } = useWhatsAppInstances();
  const connectedInstances = instances.filter((i) => i.status === "connected");

  const rawContactsWithPhone = useMemo(
    () => contacts.filter((contact) => getBestPhone(contact).length > 0),
    [contacts],
  );

  const contactsWithPhone = useMemo(
    () => dedupeContactsByPhone(rawContactsWithPhone),
    [rawContactsWithPhone],
  );

  const duplicatePhoneCount = rawContactsWithPhone.length - contactsWithPhone.length;
  const validCount = validationResults.filter((r) => r.exists).length;
  const unresolvedValidationCount = validationDone
    ? Math.max(contactsWithPhone.length - validationResults.length, 0)
    : 0;
  const invalidCount = validationResults.filter((r) => !r.exists).length + unresolvedValidationCount;

  const ensureContactAssignedToList = async (contactId: string, targetListId: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({ list_id: targetListId, updated_at: new Date().toISOString() })
      .eq("id", contactId);

    if (error) throw error;
  };

  const recoverExistingContactAssignment = async (
    contact: Contact,
    normalizedPhone: string,
    targetListId: string,
  ) => {
    const { data: existingContact, error: lookupError } = await supabase
      .from("contacts")
      .select("id, name, company, city, score, tags, custom_fields")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existingContact) return null;

    const mergedCustomFields = {
      ...normalizeCustomFieldsRecord(existingContact.custom_fields),
      ...buildContactCustomFields(contact),
    };

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        list_id: targetListId,
        name: isBlankText(existingContact.name) || existingContact.name === "Sem nome"
          ? (contact.name || existingContact.name)
          : existingContact.name,
        company: isBlankText(existingContact.company)
          ? (contact.company || contact.organization_name || existingContact.company || "")
          : existingContact.company,
        city: isBlankText(existingContact.city)
          ? (contact.city || existingContact.city || "")
          : existingContact.city,
        score: Math.max(existingContact.score || 0, contact.ai_score || 0),
        tags: Array.from(new Set([...(existingContact.tags || []), ...LEAD_SEARCH_TAGS])),
        custom_fields: mergedCustomFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingContact.id);

    if (updateError) throw updateError;

    return existingContact.id;
  };

  const handleValidate = async () => {
    if (!instanceId || contactsWithPhone.length === 0) return;

    setIsValidating(true);
    setValidationProgress(0);
    setValidationResults([]);
    setValidationDone(false);

    const numbers = contactsWithPhone.map((contact) => getBestPhone(contact));

    try {
      const progressInterval = setInterval(() => {
        setValidationProgress((prev) => Math.min(prev + 3, 90));
      }, 400);

      const { data, error } = await supabase.functions.invoke("validate-whatsapp-numbers", {
        body: { instance_id: instanceId, numbers },
      });

      clearInterval(progressInterval);

      if (error) throw error;

      const apiResults: Array<{ phone: string; exists: boolean; jid: string | null; originalIndex: number; originalPhone: string }> = data.results || [];

      const mapped: ValidationResult[] = apiResults.map((result) => ({
        phone: result.phone,
        originalPhone: result.originalPhone || result.phone,
        index: result.originalIndex ?? 0,
        exists: result.exists,
        jid: result.jid,
      }));

      setValidationResults(mapped);
      setValidationProgress(100);
      setValidationDone(true);

      if (mapped.length === 0) {
        toast.warning("Nenhum número pôde ser validado. Eles serão tratados como inválidos.");
      } else if (mapped.length < contactsWithPhone.length) {
        toast.warning(`${contactsWithPhone.length - mapped.length} número(s) ficaram fora da validação e serão tratados como inválidos.`);
      }
    } catch (err: any) {
      console.error("Validation error:", err);
      toast.error("Erro na validação: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateList = async () => {
    setIsGenerating(true);

    try {
      const contactsToAdd = validationDone
        ? contactsWithPhone
            .map((contact, index) => ({ contact, index }))
            .filter(({ index }) => validationResults.some((result) => result.index === index && result.exists))
        : contactsWithPhone.map((contact, index) => ({ contact, index }));

      if (validationDone && contactsToAdd.length === 0) {
        toast.error("Nenhum número válido foi encontrado na validação");
        setIsGenerating(false);
        return;
      }

      let targetListId = selectedListId;

      if (selectedListId === "new") {
        if (!listName.trim()) {
          toast.error("Informe o nome da lista");
          setIsGenerating(false);
          return;
        }

        const newList = await addList.mutateAsync({ name: listName.trim(), source: "lead-search" });
        targetListId = newList.id;
      }

      let newCount = 0;
      let reusedCount = 0;
      let linkedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < contactsToAdd.length; i++) {
        const { contact } = contactsToAdd[i];
        const normalizedPhone = normalizePhone(getBestPhone(contact));
        const customFields = buildContactCustomFields(contact);
        const whatsappValid = validationDone ? true : null;

        try {
          const { data, error } = await supabase.rpc("upsert_lead_contact", {
            p_name: contact.name || "Sem nome",
            p_phone: normalizedPhone,
            p_company: contact.company || contact.organization_name || "",
            p_city: contact.city || "",
            p_tags: [...LEAD_SEARCH_TAGS],
            p_list_id: targetListId,
            p_custom_fields: customFields,
            p_score: contact.ai_score || 0,
          });

          if (error) throw error;

          const result = data as UpsertLeadContactResult | null;
          if (result?.skipped || !result?.id) continue;

          // Update whatsapp_valid on the contact
          if (whatsappValid !== null) {
            await supabase
              .from("contacts")
              .update({ whatsapp_valid: whatsappValid })
              .eq("id", result.id);
          }

          if (result.is_new) {
            newCount++;
          } else {
            await ensureContactAssignedToList(result.id, targetListId);
            reusedCount++;
          }

          linkedCount++;
        } catch (err) {
          try {
            const recoveredContactId = await recoverExistingContactAssignment(contact, normalizedPhone, targetListId);

            if (!recoveredContactId) throw err;

            // Also update whatsapp_valid for recovered contacts
            if (whatsappValid !== null && recoveredContactId) {
              await supabase
                .from("contacts")
                .update({ whatsapp_valid: whatsappValid })
                .eq("id", recoveredContactId);
            }

            linkedCount++;
            reusedCount++;
          } catch (fallbackErr) {
            failedCount++;
            console.error("Error upserting contact:", fallbackErr);
          }
        }
      }

      const summary = `${linkedCount} contatos vinculados (${newCount} novos${reusedCount > 0 ? `, ${reusedCount} reaproveitados` : ""})`;

      if (failedCount > 0) {
        toast.warning(`Lista gerada com ${summary} e ${failedCount} falhas`);
      } else {
        toast.success(`Lista gerada com ${summary}`);
      }

      setOpen(false);
      resetState();
    } catch (err: any) {
      toast.error("Erro ao gerar lista: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsGenerating(false);
    }
  };

  const resetState = () => {
    setValidationResults([]);
    setValidationDone(false);
    setValidationProgress(0);
    setShowInvalid(false);
  };

  const invalidResults = validationResults.filter((result) => !result.exists);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetState(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <ListPlus className="w-4 h-4" /> Gerar Lista
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Lista de Contatos</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Canal de comunicação</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setChannel("whatsapp")}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left ${
                  channel === "whatsapp"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <MessageSquare className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">{contactsWithPhone.length} números únicos</p>
                </div>
              </button>
              <button
                disabled
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60"
              >
                <Mail className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">Email <Lock className="w-3 h-3" /></p>
                  <p className="text-[10px]">Em breve</p>
                </div>
              </button>
            </div>
            {duplicatePhoneCount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {duplicatePhoneCount} resultado(s) compartilhavam o mesmo número e foram consolidados para evitar duplicidade.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Salvar em lista</Label>
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a lista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <span className="flex items-center gap-1.5"><Plus className="w-3 h-3" /> Criar nova lista</span>
                </SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedListId === "new" && (
              <Input
                placeholder="Nome da nova lista"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {channel === "whatsapp" && (
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Validar Números WhatsApp
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifica quais números possuem WhatsApp antes de adicionar à lista.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Instância para validação</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name} {instance.phone_number ? `(${instance.phone_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {connectedInstances.length === 0 && (
                <p className="text-xs text-destructive">Nenhuma instância conectada para validação.</p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={isValidating || !instanceId || contactsWithPhone.length === 0}
                className="gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando... ({Math.round(validationProgress)}%)
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Validar {contactsWithPhone.length} números
                  </>
                )}
              </Button>

              {isValidating && <Progress value={validationProgress} className="h-2" />}

              {validationResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {validCount} com WhatsApp
                    </Badge>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                      <XCircle className="w-3 h-3" /> {invalidCount} sem WhatsApp
                    </Badge>
                    <Badge variant="secondary">
                      {validationResults.length > 0 ? Math.round((validCount / validationResults.length) * 100) : 0}% válidos
                    </Badge>
                  </div>

                  {invalidCount > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowInvalid((value) => !value)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-xs font-medium text-muted-foreground"
                      >
                        <span>Ver números sem WhatsApp ({invalidCount})</span>
                        {showInvalid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {showInvalid && (
                        <div className="max-h-[150px] overflow-y-auto">
                          {invalidResults.map((result, index) => (
                            <div key={index} className="flex items-center gap-2 px-3 py-1.5 border-t border-border/50">
                              <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                              <span className="text-xs font-mono text-muted-foreground">{result.originalPhone}</span>
                              <span className="text-xs text-muted-foreground/60 font-mono ml-auto">{result.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleGenerateList}
            disabled={isGenerating || contactsWithPhone.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando lista...
              </>
            ) : (
              <>
                <ListPlus className="w-4 h-4" />
                {validationDone
                  ? `Gerar lista com ${validCount} números válidos`
                  : `Gerar lista com ${contactsWithPhone.length} números únicos`}
              </>
            )}
          </Button>

          {validationDone && unresolvedValidationCount > 0 && (
            <p className="text-[10px] text-warning text-center">
              {unresolvedValidationCount} número(s) não puderam ser validados e ficaram fora da lista.
            </p>
          )}

          {!validationDone && channel === "whatsapp" && instanceId && (
            <p className="text-[10px] text-muted-foreground text-center">
              💡 Recomendado: valide os números antes de gerar a lista
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
