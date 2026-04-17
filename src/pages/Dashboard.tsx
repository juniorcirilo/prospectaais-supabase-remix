import { useEffect, useState } from "react";
import SetupWizard from "@/components/onboarding/SetupWizard";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  List,
  Loader2,
  Search,
  ArrowUpRight,
  Calendar,
  Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── data hooks ───────────────────────────────────────────── */

function useListStats() {
  return useQuery({
    queryKey: ["dashboard-list-stats"],
    queryFn: async () => {
      const { count: totalContacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      const { count: totalLists } = await supabase
        .from("contact_lists")
        .select("*", { count: "exact", head: true });

      const { count: unlistedContacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .is("list_id", null);

      const { count: validWhatsApp } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("whatsapp_valid", true);

      return {
        totalContacts: totalContacts || 0,
        totalLists: totalLists || 0,
        unlistedContacts: unlistedContacts || 0,
        validWhatsApp: validWhatsApp || 0,
      };
    },
    refetchInterval: 30000,
  });
}

function useContactLists() {
  return useQuery({
    queryKey: ["dashboard-contact-lists"],
    queryFn: async () => {
      const { data: lists } = await supabase
        .from("contact_lists")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!lists?.length) return [];

      const withCounts = await Promise.all(
        lists.map(async (list) => {
          const { count } = await supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("list_id", list.id);

          return {
            ...list,
            contact_count: count || 0,
          };
        })
      );

      return withCounts;
    },
  });
}

/* ── component ────────────────────────────────────────────── */

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useListStats();
  const { data: lists, isLoading: listsLoading } = useContactLists();
  const { isAdmin } = useAuth();
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "setup_wizard_completed")
        .maybeSingle();
      if (!data || data.value !== "true") {
        setShowWizard(true);
      }
    })();
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      <SetupWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral das suas listas de contatos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total de Contatos</p>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats?.totalContacts}
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent/10">
            <List className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Listas Criadas</p>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats?.totalLists}
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Hash className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Sem Lista</p>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats?.unlistedContacts}
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10">
            <Search className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">WhatsApp Válido</p>
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats?.validWhatsApp}
            </p>
          </div>
        </div>
      </div>

      {/* Lists Table */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Listas de Contatos</h3>
          <Link to="/contacts" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            Ver contatos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {listsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : lists?.length ? (
          <div className="space-y-2">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <List className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{list.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {list.contact_count} contatos
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(list.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                  {list.source}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <List className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda</p>
            <Link to="/scraping" className="text-xs text-primary hover:underline mt-1 inline-block">
              Criar primeira lista
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
