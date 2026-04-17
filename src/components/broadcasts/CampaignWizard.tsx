import React, { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Send, Loader2, AlertTriangle, Users, FileSpreadsheet, Check, Lock, Type, Mic, Image, Link2, GitBranch } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import CsvUploader from './CsvUploader';
import WhatsAppPhonePreview from '@/components/messages/WhatsAppPhonePreview';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useBroadcasts, CreateCampaignInput, BroadcastCampaign } from '@/hooks/useBroadcasts';
import { useContacts, Contact, ContactList } from '@/hooks/useContacts';
import { useDispatchProfiles } from '@/hooks/useDispatchProfiles';
import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { useFlows } from '@/hooks/useFlows';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { normalizeBrazilianPhone } from '@/lib/phoneUtils';
import { cn } from '@/lib/utils';

interface CampaignWizardProps { onClose: () => void; onCampaignCreated: (campaign: BroadcastCampaign) => void; }

type SourceType = 'contacts' | 'csv';

const CampaignWizard: React.FC<CampaignWizardProps> = ({ onClose, onCampaignCreated }) => {
  // Source selection
  const [sourceType, setSourceType] = useState<SourceType | null>(null);

  // CSV state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState('');

  // Contacts/lists selection state
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  // Common state
  const [step, setStep] = useState(0);
  const [campaignName, setCampaignName] = useState('');
  const [template, setTemplate] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [rotationStrategy, setRotationStrategy] = useState('single');
  const [speedProfile, setSpeedProfile] = useState<string>('');
  const [delayMin, setDelayMin] = useState(25);
  const [delayMax, setDelayMax] = useState(45);
  const [batchSize, setBatchSize] = useState(20);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(10);
  const [delayBetweenBatchesMax, setDelayBetweenBatchesMax] = useState(15);
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>('text');
  const [selectedMessageType, setSelectedMessageType] = useState<string>('text');
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<string>('');
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [selectedMediaUrls, setSelectedMediaUrls] = useState<string[]>([]);
  const [selectedMediaRotationMode, setSelectedMediaRotationMode] = useState<string>('random');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');

  const { instances } = useWhatsAppInstances();
  const { createCampaign, startCampaign } = useBroadcasts();
  const { contacts: allContacts, lists } = useContacts();
  const { profiles } = useDispatchProfiles();
  const { templates: savedTemplates } = useMessageTemplates();
  const { profiles: voiceProfiles } = useVoiceProfiles();
  const { data: flows = [] } = useFlows();
  const activeFlows = flows.filter(f => f.status === 'active' || f.status === 'draft');
  const connectedInstances = instances.filter(i => i.status === 'connected');

  const handleCsvParsed = useCallback((h: string[], r: string[][]) => { setHeaders(h); setRows(r); }, []);

  // Steps depend on source type
  const getSteps = () => {
    if (sourceType === 'csv') return ['Origem', 'Upload CSV', 'Mapear Colunas', 'Mensagem', 'Configurar e Enviar'];
    if (sourceType === 'contacts') return ['Origem', 'Selecionar Contatos', 'Mensagem', 'Configurar e Enviar'];
    return ['Origem'];
  };
  const STEPS = getSteps();

  // Get selected contacts for contacts source
  const getSelectedContacts = (): Contact[] => {
    const fromLists = allContacts.filter(c => c.list_id && selectedListIds.includes(c.list_id));
    const fromIndividual = allContacts.filter(c => selectedContactIds.includes(c.id));
    const map = new Map<string, Contact>();
    [...fromLists, ...fromIndividual].forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  };

  const filteredContacts = allContacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch) ||
    c.company.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const toggleList = (listId: string) => {
    setSelectedListIds(prev => prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]);
  };

  const selectAllFiltered = () => {
    const ids = filteredContacts.map(c => c.id);
    setSelectedContactIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      if (allSelected) return prev.filter(id => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  // Build recipients from either source
  const buildRecipients = () => {
    if (sourceType === 'csv') {
      const phoneIdx = headers.indexOf(mapping.phone || '');
      if (phoneIdx < 0) return [];
      return rows.map(row => {
        const variables: Record<string, any> = {};
        // Use variableMapping to build recipient variables from template vars
        for (const [templateVar, csvColumn] of Object.entries(variableMapping)) {
          const idx = headers.indexOf(csvColumn);
          if (idx >= 0) variables[templateVar] = row[idx];
        }
        // Also include legacy column mapping for non-phone fields
        for (const [field, column] of Object.entries(mapping)) {
          if (field === 'phone') continue;
          if (variables[field]) continue; // variableMapping takes precedence
          const idx = headers.indexOf(column);
          if (idx >= 0) variables[field] = row[idx];
        }
        const raw = row[phoneIdx] || '';
        const normalized = normalizeBrazilianPhone(raw);
        return { phone_number: normalized || raw.replace(/\D/g, ''), variables };
      }).filter(r => r.phone_number.length >= 10);
    } else {
      const selected = getSelectedContacts();
      const contactFieldMap: Record<string, (c: Contact) => string> = {
        nome: c => c.name,
        empresa: c => c.company || '',
        cidade: c => c.city || '',
      };
      return selected.map(c => {
        const variables: Record<string, any> = {};
        for (const [templateVar, contactField] of Object.entries(variableMapping)) {
          const getter = contactFieldMap[contactField];
          variables[templateVar] = getter ? getter(c) : contactField;
        }
        return {
          phone_number: normalizeBrazilianPhone(c.phone) || c.phone.replace(/\D/g, ''),
          variables,
        };
      }).filter(r => r.phone_number.length >= 10);
    }
  };

  const getPreviewData = (): Record<string, any> | null => {
    if (sourceType === 'contacts') {
      const selected = getSelectedContacts();
      if (selected.length) return { nome: selected[0].name, empresa: selected[0].company, cidade: selected[0].city };
      return null;
    }
    if (!rows.length || !headers.length) return null;
    const preview: Record<string, any> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (field === 'phone') continue;
      const idx = headers.indexOf(column);
      if (idx >= 0) preview[field] = rows[0][idx];
    }
    return preview;
  };

  const canAdvance = () => {
    if (step === 0) return !!sourceType;
    if (sourceType === 'csv') {
      if (step === 1) return headers.length > 0 && rows.length > 0;
      if (step === 2) return !!mapping.phone;
      if (step === 3) return template.trim().length > 0;
      if (step === 4) return !!campaignName.trim();
    } else {
      if (step === 1) return getSelectedContacts().length > 0;
      if (step === 2) return template.trim().length > 0;
      if (step === 3) return !!campaignName.trim();
    }
    return false;
  };

  const addCustomField = () => {
    const name = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || customFields.includes(name)) return;
    setCustomFields([...customFields, name]);
    setNewFieldName('');
  };

  const handleSubmit = async () => {
    const recipients = buildRecipients();
    if (!recipients.length) return;

    const effectiveCustomFields = sourceType === 'contacts' ? ['nome', 'empresa', 'cidade'] : customFields;
    const effectiveMapping = sourceType === 'contacts' ? { phone: 'phone', nome: 'nome', empresa: 'empresa', cidade: 'cidade' } : mapping;

    const effectiveInstanceId = rotationStrategy === 'single' ? instanceId : selectedInstanceIds[0] || '';

    const input: CreateCampaignInput = {
      name: campaignName, message_template: template, message_type: selectedMessageType,
      media_url: selectedMediaUrls.length > 0 ? selectedMediaUrls[0] : undefined,
      media_urls: selectedMediaUrls,
      media_rotation_mode: selectedMediaRotationMode,
      instance_id: effectiveInstanceId || undefined,
      delay_min_ms: delayMin * 1000, delay_max_ms: delayMax * 1000,
      batch_size: batchSize, delay_between_batches: delayBetweenBatches * 60, delay_between_batches_max: delayBetweenBatchesMax * 60,
      column_mapping: effectiveMapping, custom_fields: effectiveCustomFields, recipients,
      rotation_strategy: rotationStrategy,
      instance_ids: rotationStrategy !== 'single' ? selectedInstanceIds : [],
      voice_profile_id: selectedMessageType === 'audio' && selectedVoiceProfileId ? selectedVoiceProfileId : undefined,
      flow_id: selectedFlowId || undefined,
    };
    try {
      const campaign = await createCampaign.mutateAsync(input);
      const hasInstance = effectiveInstanceId || selectedInstanceIds.length > 0;
      if (hasInstance) await startCampaign.mutateAsync(campaign.id);
      onCampaignCreated(campaign);
    } catch {}
  };

  const isSubmitting = createCampaign.isPending || startCampaign.isPending;
  const isLastStep = step === STEPS.length - 1;
  const recipients = isLastStep ? buildRecipients() : [];
  const selectedContacts = sourceType === 'contacts' ? getSelectedContacts() : [];

  // Determine which content to render based on step + sourceType
  const renderStepContent = () => {
    // Step 0: source selection (always)
    if (step === 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Como deseja selecionar os destinatários?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setSourceType('contacts')}
              className={cn(
                "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:border-primary/50",
                sourceType === 'contacts' ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <Users className={cn("w-10 h-10", sourceType === 'contacts' ? "text-primary" : "text-muted-foreground")} />
              <div className="text-center">
                <p className="font-medium text-foreground">Contatos & Listas</p>
                <p className="text-xs text-muted-foreground mt-1">Selecione da sua base de contatos</p>
              </div>
              {allContacts.length > 0 && <span className="text-xs text-muted-foreground">{allContacts.length} contatos disponíveis</span>}
            </button>
            <button
              onClick={() => setSourceType('csv')}
              className={cn(
                "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:border-primary/50",
                sourceType === 'csv' ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <FileSpreadsheet className={cn("w-10 h-10", sourceType === 'csv' ? "text-primary" : "text-muted-foreground")} />
              <div className="text-center">
                <p className="font-medium text-foreground">Importar CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Envie um arquivo com números</p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    if (sourceType === 'csv') {
      if (step === 1) return <CsvUploader onDataParsed={handleCsvParsed} />;
      if (step === 2) return (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Telefone <span className="text-destructive">*</span></label>
            <Select value={mapping.phone || ''} onValueChange={val => setMapping({ ...mapping, phone: val })}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione a coluna do telefone" /></SelectTrigger>
              <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Campos personalizados</label>
            {customFields.map(f => (
              <div key={f} className="flex items-center gap-2">
                <div className="min-w-[120px] px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm font-mono text-primary">{`{{${f}}}`}</div>
                <Select value={mapping[f] || ''} onValueChange={val => setMapping({ ...mapping, [f]: val })}>
                  <SelectTrigger className="flex-1 bg-background"><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                  <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Nome da variável" className="flex-1" onKeyDown={e => e.key === 'Enter' && addCustomField()} />
              <button onClick={addCustomField} disabled={!newFieldName.trim()} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">Adicionar</button>
            </div>
          </div>
        </div>
      );
    }

    if (sourceType === 'contacts' && step === 1) {
      return (
        <div className="space-y-4">
          {/* Lists */}
          {lists.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Listas</h4>
              <div className="grid grid-cols-2 gap-2">
                {lists.map(l => (
                  <button
                    key={l.id}
                    onClick={() => toggleList(l.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      selectedListIds.includes(l.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                      selectedListIds.includes(l.id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedListIds.includes(l.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.contact_count} contatos</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Individual contacts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Contatos individuais</h4>
              <button onClick={selectAllFiltered} className="text-xs text-primary hover:underline">
                {filteredContacts.every(c => selectedContactIds.includes(c.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <Input placeholder="Buscar contatos..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="bg-background" />
            <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato encontrado</p>
              ) : (
                filteredContacts.map(c => {
                  const isInList = c.list_id && selectedListIds.includes(c.list_id);
                  const isSelected = selectedContactIds.includes(c.id) || isInList;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !isInList && toggleContact(c.id)}
                      className={cn(
                        "flex items-center gap-3 w-full p-2 rounded-lg text-left transition-colors",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/50",
                        isInList && "opacity-70 cursor-default"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-border"
                      )}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                      </div>
                      {c.company && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.company}</span>}
                      {isInList && <span className="text-[10px] text-primary">via lista</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground font-medium">{selectedContacts.length} contatos selecionados</p>
          </div>
        </div>
      );
    }

    // Message step (same for both sources)
    const messageStepIdx = sourceType === 'csv' ? 3 : 2;
    if (step === messageStepIdx) {
      const availableFields = sourceType === 'contacts' ? ['nome', 'empresa', 'cidade'] : customFields;

      const templateTypeFilters = [
        { id: 'text', label: 'Texto', icon: Type, enabled: true },
        { id: 'audio', label: 'Áudio', icon: Mic, enabled: true },
        { id: 'media', label: 'Mídia', icon: Image, enabled: true },
      ] as const;

      const filteredTemplates = savedTemplates.filter(st => {
        if (templateTypeFilter === 'text') return st.message_type === 'text';
        if (templateTypeFilter === 'audio') return st.message_type === 'audio';
        return ['image', 'video', 'document'].includes(st.message_type);
      });

      // Extract {{variables}} from the selected template
      const templateVars = Array.from(new Set(
        (template.match(/\{\{([^}]+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, ''))
      ));

      // Build preview variable values from mapping
      const previewVarValues: Record<string, string> = {};
      for (const v of templateVars) {
        const mappedField = variableMapping[v];
        if (mappedField) {
          // Show a sample value from first contact/row
          if (sourceType === 'contacts') {
            const selected = getSelectedContacts();
            if (selected.length > 0) {
              const fieldMap: Record<string, string> = { nome: selected[0].name, empresa: selected[0].company || '', cidade: selected[0].city || '' };
              previewVarValues[v] = fieldMap[mappedField] || mappedField;
            } else {
              previewVarValues[v] = mappedField;
            }
          } else if (rows.length > 0) {
            const colIdx = headers.indexOf(mappedField);
            previewVarValues[v] = colIdx >= 0 ? (rows[0][colIdx] || mappedField) : mappedField;
          }
        }
      }

      return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Template selection */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Selecionar template</label>

              {/* Type filter tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
                {templateTypeFilters.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => f.enabled && setTemplateTypeFilter(f.id)}
                    disabled={!f.enabled}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      templateTypeFilter === f.id
                        ? "bg-background text-foreground shadow-sm"
                        : f.enabled
                          ? "text-muted-foreground hover:text-foreground"
                          : "text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    {!f.enabled && <Lock className="w-3 h-3" />}
                    <f.icon className="w-3.5 h-3.5" />
                    {f.label}
                    {!f.enabled && <span className="text-[10px] opacity-60">em breve</span>}
                  </button>
                ))}
              </div>

              {filteredTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum template de {templateTypeFilter === 'text' ? 'texto' : templateTypeFilter === 'audio' ? 'áudio' : 'mídia'} disponível</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredTemplates.map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setTemplate(st.content);
                        setSelectedMessageType(st.message_type);
                        // Set media URLs and rotation from template
                        if (st.media_urls && st.media_urls.length > 0) {
                          setSelectedMediaUrls(st.media_urls);
                          setSelectedMediaRotationMode(st.media_rotation_mode || 'random');
                        } else {
                          setSelectedMediaUrls([]);
                        }
                        // Auto-map variables that match available fields
                        const vars = Array.from(new Set(
                          (st.content.match(/\{\{([^}]+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, ''))
                        ));
                        const autoMap: Record<string, string> = {};
                        for (const v of vars) {
                          const match = availableFields.find(f => f.toLowerCase() === v.toLowerCase());
                          if (match) autoMap[v] = match;
                        }
                        setVariableMapping(autoMap);
                        // Auto-select default voice profile for audio templates
                        if (st.message_type === 'audio') {
                          const defaultVp = voiceProfiles.find(vp => vp.is_default) || voiceProfiles[0];
                          if (defaultVp) setSelectedVoiceProfileId(defaultVp.id);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        template === st.content
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{st.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{st.category}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Variable mapping */}
            {template && templateVars.length > 0 && (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold text-foreground">Vincular variáveis</label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Relacione cada variável do template com um campo {sourceType === 'contacts' ? 'do contato' : 'do CSV'}.
                </p>
                <div className="space-y-2">
                  {templateVars.map(v => (
                    <div key={v} className="flex items-center gap-3">
                      <div className="min-w-[120px] px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs font-mono text-primary shrink-0">
                        {`{{${v}}}`}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <Select
                        value={variableMapping[v] || ''}
                        onValueChange={val => setVariableMapping(prev => ({ ...prev, [v]: val }))}
                      >
                        <SelectTrigger className="flex-1 bg-background h-9 text-xs">
                          <SelectValue placeholder="Selecione o campo" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                          {sourceType === 'csv' && headers.filter(h => !availableFields.includes(h)).map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {variableMapping[v] && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
                {templateVars.some(v => !variableMapping[v]) && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Variáveis não vinculadas serão exibidas como texto literal.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* WhatsApp Phone Preview */}
          <div className="lg:col-span-2">
            <WhatsAppPhonePreview
              content={template || "Selecione um template para visualizar..."}
              messageType={selectedMessageType}
              mediaUrl={selectedMediaUrls.length > 0 ? selectedMediaUrls[0] : undefined}
              variableValues={previewVarValues}
            />
          </div>
        </div>
      );
    }

    // Config step (last step for both)
    if (isLastStep) {
      const toggleInstanceSelection = (id: string) => {
        setSelectedInstanceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      };

      const getProfileColor = (delayMinS: number) => {
        if (delayMinS >= 40) return "text-green-500";
        if (delayMinS >= 20) return "text-yellow-500";
        return "text-red-500";
      };

      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Nome da campanha <span className="text-destructive">*</span></label>
            <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Promoção Janeiro" className="bg-background" />
          </div>

          {/* Rotation strategy */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Estratégia de instâncias</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { id: 'single', label: 'Única', desc: 'Uma instância', icon: '1️⃣' },
                { id: 'roundrobin', label: 'Intercalar', desc: 'Alterna entre instâncias', icon: '🔄' },
                { id: 'proportional', label: 'Proporcional', desc: 'Divide igualmente', icon: '⚖️' },
                { id: 'random', label: 'Aleatória', desc: 'Escolha aleatória', icon: '🎲' },
              ].map(s => (
                <button key={s.id} type="button" onClick={() => setRotationStrategy(s.id)}
                  className={cn("p-3 rounded-xl border-2 transition-all text-left", rotationStrategy === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{s.icon}</span>
                    <span className="text-sm font-medium text-foreground">{s.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Instance selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              {rotationStrategy === 'single' ? 'Instância WhatsApp' : 'Instâncias WhatsApp'}
            </label>
            {rotationStrategy === 'single' ? (
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
                <SelectContent>{connectedInstances.map(inst => <SelectItem key={inst.id} value={inst.id}>{inst.name} {inst.phone_number ? `(${inst.phone_number})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
                {connectedInstances.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma instância conectada</p>
                ) : connectedInstances.map(inst => (
                  <button key={inst.id} type="button" onClick={() => toggleInstanceSelection(inst.id)}
                    className={cn("flex items-center gap-3 w-full p-2 rounded-lg text-left transition-colors", selectedInstanceIds.includes(inst.id) ? "bg-primary/5" : "hover:bg-muted/50")}>
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", selectedInstanceIds.includes(inst.id) ? "bg-primary border-primary" : "border-border")}>
                      {selectedInstanceIds.includes(inst.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className="text-sm text-foreground">{inst.name}</span>
                    {inst.phone_number && <span className="text-xs text-muted-foreground font-mono">{inst.phone_number}</span>}
                  </button>
                ))}
              </div>
            )}
            {!connectedInstances.length && <p className="text-xs text-destructive">Nenhuma instância conectada.</p>}

          {/* Voice Profile selector for audio campaigns */}
          {selectedMessageType === 'audio' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Perfil de voz (TTS)</label>
              {voiceProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum perfil de voz disponível — crie em Perfis de Voz</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {voiceProfiles.map(vp => (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => setSelectedVoiceProfileId(vp.id)}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all text-left",
                        selectedVoiceProfileId === vp.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Mic className={cn("w-4 h-4", selectedVoiceProfileId === vp.id ? "text-primary" : "text-muted-foreground")} />
                        <p className="text-sm font-medium text-foreground">{vp.name}</p>
                        {vp.is_default && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Padrão</Badge>}
                      </div>
                      {vp.description && <p className="text-[11px] text-muted-foreground mt-1">{vp.description}</p>}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Modelo: {vp.elevenlabs_model} · Vel: {vp.speed}x
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
            {rotationStrategy !== 'single' && selectedInstanceIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedInstanceIds.length} instância(s) selecionada(s)</p>
            )}
          </div>

          {/* Speed profile selector from DB */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Perfil de velocidade</label>
            {profiles.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {profiles.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setSpeedProfile(p.id); setDelayMin(p.delay_min_s); setDelayMax(p.delay_max_s); setBatchSize(p.batch_size); setDelayBetweenBatches(p.pause_between_batches_min); setDelayBetweenBatchesMax(p.pause_between_batches_max); }}
                    className={cn("p-3 rounded-xl border-2 transition-all text-left", speedProfile === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                    <p className={cn("text-sm font-semibold", getProfileColor(p.delay_min_s))}>{p.name}</p>
                    {p.description && <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>}
                    <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                      <p>Delay: {p.delay_min_s}-{p.delay_max_s}s</p>
                      <p>Lote: {p.batch_size} msgs</p>
                      <p>Pausa: {p.pause_between_batches_min}-{p.pause_between_batches_max} min</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum perfil disponível — crie em Motor de Disparo</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Personalizar</label>
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Min: {delayMin}s</span><span className="text-xs text-muted-foreground">Max: {delayMax}s</span></div>
            <Slider value={[delayMin]} onValueChange={([v]) => { setDelayMin(v); setSpeedProfile('custom'); if (v > delayMax) setDelayMax(v); }} min={1} max={120} step={1} />
            <Slider value={[delayMax]} onValueChange={([v]) => { setDelayMax(v); setSpeedProfile('custom'); if (v < delayMin) setDelayMin(v); }} min={1} max={120} step={1} />
            {delayMin < 3 && <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg"><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-xs text-destructive">Delay abaixo de 3s aumenta risco de bloqueio</span></div>}
          </div>
          <div className="space-y-3 p-4 bg-secondary/30 border border-border rounded-xl">
            <label className="text-sm font-semibold text-foreground">Lotes</label>
            <div><span className="text-xs text-muted-foreground">Mensagens por lote: <strong className="text-foreground">{batchSize}</strong></span></div>
            <Slider value={[batchSize]} onValueChange={([v]) => { setBatchSize(v); setSpeedProfile('custom'); }} min={1} max={50} step={1} />
            <div><span className="text-xs text-muted-foreground">Pausa entre lotes: <strong className="text-foreground">{delayBetweenBatches}-{delayBetweenBatchesMax} min</strong></span></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Mín: {delayBetweenBatches} min</span>
                <Slider value={[delayBetweenBatches]} onValueChange={([v]) => { setDelayBetweenBatches(v); setSpeedProfile('custom'); if (v > delayBetweenBatchesMax) setDelayBetweenBatchesMax(v); }} min={1} max={60} step={1} />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Máx: {delayBetweenBatchesMax} min</span>
                <Slider value={[delayBetweenBatchesMax]} onValueChange={([v]) => { setDelayBetweenBatchesMax(v); setSpeedProfile('custom'); if (v < delayBetweenBatches) setDelayBetweenBatches(v); }} min={1} max={90} step={1} />
              </div>
            </div>
          </div>

          {/* Flow linkage */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              Fluxo de follow-up (opcional)
            </label>
            <p className="text-xs text-muted-foreground">Quando o lead responder, será direcionado automaticamente para este fluxo</p>
            <Select value={selectedFlowId || "none"} onValueChange={(v) => setSelectedFlowId(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Nenhum fluxo vinculado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {activeFlows.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} <span className="text-muted-foreground">({f.status === 'active' ? 'Ativo' : 'Rascunho'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-secondary/50 border border-border rounded-xl space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Resumo</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Destinatários:</span><span className="text-foreground font-medium">{recipients.length}</span>
              <span className="text-muted-foreground">Lotes:</span><span className="text-foreground font-medium">{Math.ceil(recipients.length / batchSize)}</span>
              <span className="text-muted-foreground">Rotação:</span><span className="text-foreground font-medium capitalize">{rotationStrategy === 'single' ? 'Única' : rotationStrategy}</span>
              <span className="text-muted-foreground">Instâncias:</span><span className="text-foreground font-medium">{rotationStrategy === 'single' ? '1' : selectedInstanceIds.length}</span>
              <span className="text-muted-foreground">Fonte:</span><span className="text-foreground font-medium">{sourceType === 'csv' ? 'CSV' : 'Contatos'}</span>
              {selectedFlowId && <>
                <span className="text-muted-foreground">Fluxo:</span>
                <span className="text-foreground font-medium">{activeFlows.find(f => f.id === selectedFlowId)?.name || '—'}</span>
              </>}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={step === 0 ? onClose : () => setStep(step - 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors"><ArrowLeft className="w-5 h-5 text-muted-foreground" /></button>
          <div><h2 className="text-lg font-bold text-foreground">Nova Campanha</h2><p className="text-xs text-muted-foreground">Passo {step + 1} de {STEPS.length}</p></div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-6 py-3 border-b border-border/50">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>{i + 1}</div>
            <span className={`text-xs hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {renderStepContent()}
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border">
        <button onClick={step === 0 ? onClose : () => setStep(step - 1)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{step === 0 ? 'Cancelar' : 'Voltar'}</button>
        {!isLastStep ? (
          <button onClick={() => setStep(step + 1)} disabled={!canAdvance()} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">Próximo<ArrowRight className="w-4 h-4" /></button>
        ) : (
          <button onClick={handleSubmit} disabled={!canAdvance() || isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Criando...</> : <><Send className="w-4 h-4" />Disparar</>}
          </button>
        )}
      </div>
    </div>
  );
};

export default CampaignWizard;
