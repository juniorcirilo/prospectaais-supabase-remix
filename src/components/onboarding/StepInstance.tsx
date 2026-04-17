import React, { useState, useEffect, useRef } from "react";
import { Smartphone, ArrowRight, Loader2, QrCode, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepInstanceProps {
  evoUrl: string;
  evoKey: string;
}

type InstanceStep = "form" | "creating" | "qrcode" | "connected";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StepInstance({ evoUrl, evoKey }: StepInstanceProps) {
  const [step, setStep] = useState<InstanceStep>("form");
  const [name, setName] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const credentialsConfigured = !!(evoUrl?.trim() && evoKey?.trim());

  const handleNameChange = (val: string) => {
    setName(val);
    setInstanceName(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, ""));
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const fetchQr = async (id: string) => {
    setIsFetchingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-evolution-qrcode", { body: { instance_id: id } });
      if (error) throw error;
      if (data?.connected) {
        setQrCode(null);
        setStep("connected");
        stopPolling();
        toast.success("WhatsApp conectado!");
        return;
      }
      if (data?.qr_code) setQrCode(data.qr_code);
    } catch (err) {
      console.error("Error fetching QR:", err);
    } finally {
      setIsFetchingQr(false);
    }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase.functions.invoke("get-evolution-qrcode", { body: { instance_id: id } });
      if (data?.connected) {
        setQrCode(null);
        setStep("connected");
        stopPolling();
        toast.success("WhatsApp conectado!");
      } else if (data?.qr_code) {
        setQrCode(data.qr_code);
      }
    }, 5000);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da conexão");
      return;
    }
    if (!credentialsConfigured) {
      toast.error("Configure a Evolution API no passo anterior primeiro");
      return;
    }

    setIsCreating(true);
    setStep("creating");

    try {
      const { data, error } = await supabase.functions.invoke("create-evolution-instance", {
        body: { instance_name: instanceName, name, is_default: true },
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro ao criar instância");

      setInstanceId(data.instance_id);

      if (data.qr_code) {
        setQrCode(data.qr_code);
        setStep("qrcode");
        startPolling(data.instance_id);
      } else {
        setStep("qrcode");
        await fetchQr(data.instance_id);
        startPolling(data.instance_id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("form");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="text-center mb-6">
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Smartphone className="w-8 h-8 text-primary" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Conectar WhatsApp</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Crie sua primeira instância e conecte via QR Code.
        </p>
      </motion.div>

      {step === "form" && (
        <motion.div variants={itemVariants} className="space-y-4 max-w-md mx-auto">
          {!credentialsConfigured && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-foreground">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs">
                Configure a <strong>Evolution API</strong> no passo anterior antes de criar uma instância.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wizardInstanceName">Nome da Conexão</Label>
            <Input
              id="wizardInstanceName"
              placeholder="Ex: WhatsApp Vendas"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Identificador{" "}
              <span className="text-muted-foreground font-normal ml-1 text-xs">(gerado automaticamente)</span>
            </Label>
            <Input value={instanceName} disabled className="bg-muted/50 font-mono text-sm" />
          </div>

          <Button
            onClick={handleCreate}
            disabled={!credentialsConfigured || !name.trim() || isCreating}
            className="w-full gap-2"
          >
            Criar e Conectar <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {step === "creating" && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Criando instância...</p>
            <p className="text-sm text-muted-foreground mt-1">Conectando ao Evolution API e gerando QR Code</p>
          </div>
        </div>
      )}

      {step === "qrcode" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="font-medium text-foreground">Escaneie o QR Code</p>
            <p className="text-sm text-muted-foreground">
              WhatsApp → Menu → Aparelhos Conectados → Conectar
            </p>
          </div>
          <div className="w-52 h-52 rounded-xl border-2 border-primary/20 bg-card flex items-center justify-center overflow-hidden">
            {isFetchingQr && !qrCode ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs">Gerando QR...</span>
              </div>
            ) : qrCode ? (
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="w-10 h-10" />
                <span className="text-xs">QR não disponível</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Aguardando conexão automaticamente...
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => instanceId && fetchQr(instanceId)}
            disabled={isFetchingQr}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingQr ? "animate-spin" : ""}`} />
            Atualizar QR
          </Button>
        </div>
      )}

      {step === "connected" && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20"
          >
            <CheckCircle className="w-10 h-10 text-primary" />
          </motion.div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-lg">WhatsApp Conectado!</p>
            <p className="text-sm text-muted-foreground mt-1">
              A instância <strong>{name}</strong> está ativa e pronta para uso.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
