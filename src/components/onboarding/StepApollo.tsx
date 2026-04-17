import { useState } from "react";
import { Search, Key, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StepApolloProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StepApollo({ apiKey, onApiKeyChange }: StepApolloProps) {
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!apiKey?.trim()) {
      toast.error("Preencha a API Key antes de testar");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-apollo-connection", {
        body: { api_key: apiKey.trim() },
      });
      if (error) throw error;
      if (data?.ok) {
        setTestResult({ ok: true, message: data.message });
        toast.success("Apollo conectado!");
      } else {
        setTestResult({ ok: false, message: data?.message || "API Key inválida" });
        toast.error("API Key inválida");
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || "Erro de conexão" });
      toast.error("Falha ao testar Apollo");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Search className="w-8 h-8 text-blue-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Apollo.io</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Configure o Apollo para busca e enriquecimento de leads.
        </p>
        <p className="text-xs text-amber-500/80 mt-2">⚡ Esta configuração é opcional</p>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" /> API Key do Apollo
          </Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { onApiKeyChange(e.target.value); setTestResult(null); }}
              placeholder="Sua API Key do Apollo.io"
              className="pr-10 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenha em{" "}
            <a href="https://app.apollo.io/#/settings/integrations/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              apollo.io
            </a>
          </p>
        </motion.div>

        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
              testResult.ok
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}
          >
            {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {testResult.message}
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey?.trim()}
            className="w-full gap-2"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {isTesting ? "Testando..." : "Testar Conexão"}
          </Button>
        </motion.div>

        <motion.div variants={itemVariants} className="p-4 rounded-lg bg-secondary/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">O que o Apollo faz?</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Busca empresas e contatos por setor, cidade e cargo</li>
            <li>• Enriquece dados com telefone, e-mail e redes sociais</li>
            <li>• Importa leads diretamente para suas listas de contatos</li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}
