import { Shield, User, Bot, Zap, Clock, ArrowDown, MessageCircle, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import StatCard from "@/components/StatCard";

const activeConversations = [
  { contact: "João Silva", agent: "human", agentName: "Rafael (Vendedor)", since: "14:20", msgs: 5, status: "Negociando" },
  { contact: "Maria Santos", agent: "ai", agentName: "IA Atendimento", since: "14:25", msgs: 3, status: "Respondendo dúvidas" },
  { contact: "Pedro Almeida", agent: "dispatcher", agentName: "Disparador", since: "14:10", msgs: 1, status: "Aguardando resposta" },
  { contact: "Ana Costa", agent: "none", agentName: "Nenhum", since: "13:45", msgs: 0, status: "Lead abandonado" },
];

const agentConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  human: { icon: <User className="w-4 h-4" />, color: "text-warning" },
  ai: { icon: <Bot className="w-4 h-4" />, color: "text-info" },
  dispatcher: { icon: <Zap className="w-4 h-4" />, color: "text-primary" },
  none: { icon: <Shield className="w-4 h-4" />, color: "text-destructive" },
};

export default function Agents() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Convivência de Agentes</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerenciamento de prioridade entre disparador, IA e humanos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Humanos Ativos" value="3" subtitle="2 vendedores, 1 suporte" icon={<User className="w-5 h-5 text-warning" />} />
        <StatCard title="IA Ativa" value="8" subtitle="Conversas em andamento" icon={<Bot className="w-5 h-5 text-info" />} />
        <StatCard title="Disparador" value="134" subtitle="Contatos na fila" icon={<Zap className="w-5 h-5 text-primary" />} />
        <StatCard title="Conflitos Evitados" value="23" subtitle="Hoje" icon={<Shield className="w-5 h-5 text-success" />} />
      </div>

      {/* Priority hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hierarquia de Prioridade</CardTitle>
          <CardDescription>Quando um agente de maior prioridade assume, os demais pausam automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {[
              { label: "Humano", icon: User, desc: "Prioridade total", color: "border-warning/30 bg-warning/5" },
              { label: "IA Externa", icon: Bot, desc: "Pausa disparador", color: "border-info/30 bg-info/5" },
              { label: "Disparador", icon: Zap, desc: "Base automática", color: "border-primary/30 bg-primary/5" },
            ].map((a, i) => (
              <div key={a.label} className="flex items-center gap-4 flex-1">
                <div className={`flex-1 p-4 rounded-xl border ${a.color} text-center`}>
                  <a.icon className="w-6 h-6 mx-auto mb-2 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                  <Badge variant="secondary" className="mt-2">Nível {i + 1}</Badge>
                </div>
                {i < 2 && <ArrowDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-[-90deg]" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cooldown settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Regras de Cooldown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Cooldown após IA</label>
                <span className="text-sm text-muted-foreground">4 horas</span>
              </div>
              <Slider defaultValue={[4]} max={24} min={1} step={1} />
              <p className="text-xs text-muted-foreground">Disparador não envia se IA interagiu nas últimas 4h</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Cooldown após Humano</label>
                <span className="text-sm text-muted-foreground">3 dias</span>
              </div>
              <Slider defaultValue={[3]} max={14} min={1} step={1} />
              <p className="text-xs text-muted-foreground">Disparador não envia se humano interagiu nos últimos 3 dias</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-devolver para automação</p>
              <p className="text-xs text-muted-foreground">Se ninguém interage por 7 dias, retorna ao disparador</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Active conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversas Ativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeConversations.map((c, i) => {
            const ac = agentConfig[c.agent];
            return (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center ${ac.color}`}>
                  {ac.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.contact}</span>
                    <Badge variant="secondary" className="text-xs">{c.agentName}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.status} • {c.msgs} msgs • desde {c.since}</p>
                </div>
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
