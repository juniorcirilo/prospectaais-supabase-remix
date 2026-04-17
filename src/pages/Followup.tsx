import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListOrdered, Activity, ScrollText } from "lucide-react";
import SequencesList from "@/components/followup/SequencesList";
import MonitorTab from "@/components/followup/MonitorTab";
import LogsTab from "@/components/followup/LogsTab";
import FollowupChat from "@/components/followup/FollowupChat";
import SequenceDetail from "@/components/followup/SequenceDetail";
import ManualSequenceEditor from "@/components/followup/ManualSequenceEditor";
import { FollowupSequence } from "@/hooks/useFollowup";

export default function Followup() {
  const [view, setView] = useState<"list" | "chat" | "detail" | "manual-edit">("list");
  const [selectedSequence, setSelectedSequence] = useState<FollowupSequence | null>(null);
  const [editingSequence, setEditingSequence] = useState<FollowupSequence | null>(null);

  if (view === "chat") {
    return (
      <div className="animate-fade-in-up">
        <FollowupChat
          onBack={() => { setView("list"); setEditingSequence(null); }}
          editingSequence={editingSequence}
        />
      </div>
    );
  }

  if (view === "manual-edit" && selectedSequence) {
    return (
      <ManualSequenceEditor
        sequence={selectedSequence}
        onBack={() => { setView("detail"); }}
      />
    );
  }

  if (view === "detail" && selectedSequence) {
    return (
      <SequenceDetail
        sequence={selectedSequence}
        onBack={() => { setView("list"); setSelectedSequence(null); }}
        onEdit={(seq) => { setEditingSequence(seq); setView("chat"); }}
        onManualEdit={(seq) => { setSelectedSequence(seq); setView("manual-edit"); }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Follow-up Inteligente</h1>
        <p className="text-sm text-muted-foreground mt-1">Sequências automatizadas de follow-up com análise contextual</p>
      </div>

      <Tabs defaultValue="sequences" className="w-full">
        <TabsList>
          <TabsTrigger value="sequences" className="gap-1.5">
            <ListOrdered className="w-4 h-4" /> Sequências
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-1.5">
            <Activity className="w-4 h-4" /> Monitor
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="w-4 h-4" /> Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sequences">
          <SequencesList
            onNewSequence={() => { setEditingSequence(null); setView("chat"); }}
            onSelectSequence={(seq) => { setSelectedSequence(seq); setView("detail"); }}
          />
        </TabsContent>

        <TabsContent value="monitor">
          <MonitorTab />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
