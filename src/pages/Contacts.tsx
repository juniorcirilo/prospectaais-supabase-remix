import { useState } from "react";
import { Plus, Search, Upload, Download, Tag, MoreVertical, Trash2, Edit, Loader2, Users, X, List, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useContacts, Contact } from "@/hooks/useContacts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ContactImportDialog from "@/components/contacts/ContactImportDialog";

type ContactStatus = "novo" | "disparado" | "respondeu" | "interessado" | "convertido" | "optout" | "bloqueado";

const statusColors: Record<ContactStatus, string> = {
  novo: "bg-info/15 text-info",
  disparado: "bg-warning/15 text-warning",
  respondeu: "bg-primary/15 text-primary",
  interessado: "bg-success/15 text-success",
  convertido: "bg-success/15 text-success",
  optout: "bg-muted text-muted-foreground",
  bloqueado: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  novo: "Novo", disparado: "Disparado", respondeu: "Respondeu",
  interessado: "Interessado", convertido: "Convertido", optout: "Opt-out", bloqueado: "Bloqueado",
};

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [activeList, setActiveList] = useState<string | null>(null);
  const { contacts, lists, isLoading, listsLoading, addContact, updateContact, deleteContact, addList, deleteList, importContacts } = useContacts(activeList);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addListDialogOpen, setAddListDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [listPopoverOpen, setListPopoverOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formListId, setFormListId] = useState<string>("");
  const [formListName, setFormListName] = useState("");
  const [formListSource, setFormListSource] = useState("manual");

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const totalContacts = contacts.length;
  const activeListObj = lists.find(l => l.id === activeList);

  const filteredLists = lists.filter(l =>
    l.name.toLowerCase().includes(listSearch.toLowerCase())
  );

  const openAddDialog = () => {
    setFormName(""); setFormPhone(""); setFormCompany(""); setFormCity(""); setFormTags(""); setFormListId("");
    setEditContact(null);
    setAddDialogOpen(true);
  };

  const openEditDialog = (c: Contact) => {
    setFormName(c.name); setFormPhone(c.phone); setFormCompany(c.company); setFormCity(c.city);
    setFormTags((c.tags || []).join(", ")); setFormListId(c.list_id || "");
    setEditContact(c);
    setAddDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
    if (editContact) {
      await updateContact.mutateAsync({
        id: editContact.id, name: formName, phone: formPhone,
        company: formCompany, city: formCity, tags,
        list_id: formListId || null,
      });
    } else {
      await addContact.mutateAsync({
        name: formName, phone: formPhone, company: formCompany, city: formCity,
        tags, list_id: formListId || null, status: "novo", score: 0,
      });
    }
    setAddDialogOpen(false);
  };

  const handleCreateList = async () => {
    if (!formListName.trim()) { toast.error("Nome da lista obrigatório"); return; }
    await addList.mutateAsync({ name: formListName, source: formListSource });
    setAddListDialogOpen(false);
    setFormListName(""); setFormListSource("manual");
  };

  const handleDeleteList = async () => {
    if (!deleteListId) return;
    if (activeList === deleteListId) setActiveList(null);
    await deleteList.mutateAsync(deleteListId);
    setDeleteListId(null);
  };

  const handleExportCsv = () => {
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const headers = [
      "Nome", "E-mail", "Telefone", "Empresa", "Cidade",
      "Status", "Score", "Tags", "Website", "WhatsApp",
      "Instagram", "Facebook", "LinkedIn", "Setor", "Serviços",
      "AI Score", "AI Insights"
    ];
    const header = headers.join(";");

    const rows = contacts.map(c => {
      const cf = (c.custom_fields || {}) as Record<string, string>;
      return [
        escape(c.name),
        escape(cf.email || cf.company_email || ""),
        escape(c.phone),
        escape(c.company || ""),
        escape(c.city || ""),
        escape(c.status),
        String(c.score),
        escape((c.tags || []).join("; ")),
        escape(cf.website || ""),
        escape(cf.whatsapp_site || ""),
        escape(cf.instagram || ""),
        escape(cf.facebook || ""),
        escape(cf.linkedin || cf.linkedin_url || cf.company_linkedin || ""),
        escape(cf.industry || ""),
        escape(cf.company_services || ""),
        escape(cf.ai_score || ""),
        escape(cf.ai_insights || ""),
      ].join(";");
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos${activeListObj ? "_" + activeListObj.name.replace(/\s+/g, "_") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalContacts} contatos · {lists.length} listas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={contacts.length === 0}>
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setFormListName(""); setFormListSource("manual"); setAddListDialogOpen(true); }}>
            <Users className="w-4 h-4" /> Nova Lista
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" /> Novo Contato
          </Button>
        </div>
      </div>

      {/* Search + List Selector Row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, empresa, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>

        {/* Compact List Selector */}
        <Popover open={listPopoverOpen} onOpenChange={setListPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
              <div className="flex items-center gap-2 truncate">
                <List className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">
                  {activeListObj ? activeListObj.name : "Todas as listas"}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="end">
            <div className="p-2 border-b border-border">
              <Input
                placeholder="Buscar lista..."
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto p-1">
              <button
                onClick={() => { setActiveList(null); setListPopoverOpen(false); setListSearch(""); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  !activeList ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                )}
              >
                <span>Todas as listas</span>
                <span className="text-xs text-muted-foreground">{contacts.length}</span>
              </button>
              {listsLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : filteredLists.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhuma lista encontrada</p>
              ) : (
                filteredLists.map(l => (
                  <div
                    key={l.id}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                      activeList === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                    )}
                  >
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => { setActiveList(l.id); setListPopoverOpen(false); setListSearch(""); }}
                    >
                      <span className="truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({l.contact_count})</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteListId(l.id); setListPopoverOpen(false); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Excluir lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {activeList && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setActiveList(null)} title="Limpar filtro">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-border rounded-lg">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">{search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}</p>
          <Button variant="outline" size="sm" onClick={openAddDialog}><Plus className="w-4 h-4 mr-2" />Adicionar Contato</Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Telefone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Empresa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Cidade</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                  <th className="text-center text-xs font-medium text-muted-foreground p-4">Score</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-4">Tags</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4 text-sm font-medium text-foreground">{c.name}</td>
                    <td className="p-4 text-sm text-muted-foreground font-mono text-xs">{c.phone}</td>
                    <td className="p-4 text-sm text-muted-foreground">{c.company || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{c.city || "—"}</td>
                    <td className="p-4">
                      <span className={cn("badge-status", statusColors[c.status as ContactStatus] || "bg-muted text-muted-foreground")}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={cn("text-sm font-bold", c.score >= 80 ? "text-success" : c.score >= 50 ? "text-warning" : "text-destructive")}>
                        {c.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        {(c.tags || []).map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            <Tag className="w-2.5 h-2.5" />{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(c)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            <DialogDescription>{editContact ? "Atualize os dados do contato" : "Adicione um novo contato à base"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome completo" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input placeholder="+55 11 99999-9999" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input placeholder="Empresa" value={formCompany} onChange={e => setFormCompany(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="Cidade" value={formCity} onChange={e => setFormCity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-xs text-muted-foreground">(separadas por vírgula)</span></Label>
              <Input placeholder="tag1, tag2" value={formTags} onChange={e => setFormTags(e.target.value)} />
            </div>
            {lists.length > 0 && (
              <div className="space-y-1.5">
                <Label>Lista</Label>
                <Select value={formListId} onValueChange={setFormListId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma lista (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveContact} disabled={addContact.isPending || updateContact.isPending}>
                {(addContact.isPending || updateContact.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editContact ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New List Dialog */}
      <Dialog open={addListDialogOpen} onOpenChange={setAddListDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Lista</DialogTitle>
            <DialogDescription>Crie uma lista para organizar seus contatos</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da Lista *</Label>
              <Input placeholder="Ex: Leads Evento 2026" value={formListName} onChange={e => setFormListName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={formListSource} onValueChange={setFormListSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="importacao">Importação</SelectItem>
                  <SelectItem value="scraping">Scraping</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAddListDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateList} disabled={addList.isPending}>
                {addList.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar Lista
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <ContactImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        lists={lists}
        activeListId={activeList}
      />

      {/* Delete Contact Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteContact.mutate(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete List Confirmation */}
      <AlertDialog open={!!deleteListId} onOpenChange={(open) => !open && setDeleteListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Os contatos desta lista não serão excluídos, apenas desvinculados. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteList.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
