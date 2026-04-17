import { useState } from "react";
import { Plus, Search, MoreVertical, Play, Pause, Copy, Trash2, Loader2, Megaphone, X, RotateCcw } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBroadcasts, BroadcastCampaign } from "@/hooks/useBroadcasts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CampaignWizard from "@/components/broadcasts/CampaignWizard";
import CampaignDetails from "@/components/broadcasts/CampaignDetails";

const statusMap: Record<string, "active" | "paused" | "completed" | "draft" | "error"> = {
  processing: "active", sending: "active", paused: "paused",
  completed: "completed", draft: "draft", failed: "error",
};

export default function Campaigns() {
  const [search, setSearch] = useState("");
  const { campaigns, isLoading, pauseCampaign, resumeCampaign, cancelCampaign, resetCampaign } = useBroadcasts();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [viewCampaign, setViewCampaign] = useState<BroadcastCampaign | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = campaigns.filter(c => ['processing', 'sending'].includes(c.status)).length;

  if (wizardOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <CampaignWizard
          onClose={() => setWizardOpen(false)}
          onCampaignCreated={() => setWizardOpen(false)}
        />
      </div>
    );
  }

  if (viewCampaign) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <CampaignDetails campaign={viewCampaign} onBack={() => setViewCampaign(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">{campaigns.length} campanhas · {activeCount} ativas</p>
        </div>
        <Button className="gap-2" onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4" /> Nova Campanha
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar campanhas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-border rounded-lg">
          <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">{search ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada"}</p>
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}><Plus className="w-4 h-4 mr-2" />Criar Campanha</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const displayStatus = statusMap[c.status] || "draft";
            const deliveryRate = c.total_recipients > 0 ? ((c.sent_count / c.total_recipients) * 100) : 0;
            return (
              <div key={c.id} className="glass-card p-5 hover:border-primary/30 transition-colors cursor-pointer animate-fade-in-up" onClick={() => setViewCampaign(c)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
                      <StatusBadge status={displayStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criada em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {['processing', 'sending'].includes(c.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => pauseCampaign.mutate(c.id)}>
                        <Pause className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {c.status === 'paused' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resumeCampaign.mutate(c.id)}>
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status === 'draft' && (
                          <DropdownMenuItem onClick={() => resumeCampaign.mutate(c.id)}><Play className="w-4 h-4 mr-2" />Iniciar</DropdownMenuItem>
                        )}
                        {['completed', 'failed', 'paused'].includes(c.status) && (
                          <DropdownMenuItem onClick={() => setResetId(c.id)}><RotateCcw className="w-4 h-4 mr-2" />Resetar</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setCancelId(c.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total", value: c.total_recipients },
                    { label: "Enviados", value: c.sent_count },
                    { label: "Falhas", value: c.failed_count },
                  ].map((m) => (
                    <div key={m.label} className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                {c.total_recipients > 0 && (
                  <div className="mt-3 flex gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${deliveryRate}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{deliveryRate.toFixed(1)}% enviado</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar campanha?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação irá interromper o envio permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelId) { cancelCampaign.mutate(cancelId); setCancelId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirmation */}
      <AlertDialog open={!!resetId} onOpenChange={(open) => !open && setResetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar campanha?</AlertDialogTitle>
            <AlertDialogDescription>Todos os destinatários voltarão para "pendente" e os contadores serão zerados. A campanha ficará como rascunho para ser disparada novamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (resetId) { resetCampaign.mutate(resetId); setResetId(null); } }}>
              Resetar Campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
