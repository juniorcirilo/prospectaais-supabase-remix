import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Loader2, Settings2, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StepEvolution from "./StepEvolution";
import StepApollo from "./StepApollo";
import StepInstance from "./StepInstance";
import StepFinish from "./StepFinish";

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: "evolution", title: "Evolution API" },
  { id: "instance", title: "Instância WhatsApp", optional: true },
  { id: "apollo", title: "Apollo.io", optional: true },
  { id: "finish", title: "Concluído" },
];

const stepVariants = {
  enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.95, filter: "blur(8px)" }),
  center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: (d: number) => ({ x: d < 0 ? 80 : -80, opacity: 0, scale: 0.95, filter: "blur(8px)" }),
};

const AnimatedCheckmark = () => (
  <motion.svg viewBox="0 0 24 24" className="w-4 h-4" initial="hidden" animate="visible">
    <motion.path
      d="M5 13l4 4L19 7"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={{
        hidden: { pathLength: 0, opacity: 0 },
        visible: { pathLength: 1, opacity: 1, transition: { pathLength: { duration: 0.4 }, opacity: { duration: 0.1 } } },
      }}
    />
  </motion.svg>
);

const StepCircle = ({ index, activeStep, isOptional, onClick }: { index: number; activeStep: number; isOptional?: boolean; onClick: () => void }) => {
  const isCompleted = index < activeStep;
  const isActive = index === activeStep;
  return (
    <motion.button onClick={onClick} className="relative z-10 flex-shrink-0" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}>
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ margin: "-4px" }}
        />
      )}
      <motion.div
        className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-300 ${
          isCompleted
            ? "bg-gradient-to-br from-primary to-primary/80 border-primary text-primary-foreground shadow-lg"
            : isActive
            ? "border-primary text-primary bg-primary/10 shadow-lg"
            : isOptional
            ? "border-border text-muted-foreground bg-muted/50 border-dashed"
            : "border-border text-muted-foreground bg-muted/50"
        }`}
      >
        {isCompleted ? <AnimatedCheckmark /> : <span className="text-xs font-semibold">{index + 1}</span>}
      </motion.div>
    </motion.button>
  );
};

const ConnectingLine = ({ isCompleted }: { isCompleted: boolean }) => (
  <div className="relative flex-1 h-0.5 mx-1 bg-border rounded-full overflow-hidden self-center min-w-[12px]">
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: isCompleted ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      style={{ transformOrigin: "left" }}
    />
  </div>
);

export default function SetupWizard({ isOpen, onClose }: SetupWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Evolution
  const [evoUrl, setEvoUrl] = useState("");
  const [evoKey, setEvoKey] = useState("");
  // Apollo
  const [apolloKey, setApolloKey] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setActiveStep(0);
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "evolution_api_url", "evolution_api_key",
          "apollo_api_key",
        ]);
      if (data) {
        for (const r of data) {
          if (r.key === "evolution_api_url") setEvoUrl(r.value);
          if (r.key === "evolution_api_key") setEvoKey(r.value);
          if (r.key === "apollo_api_key") setApolloKey(r.value);
        }
      }
    })();
  }, [isOpen]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const pairs = [
        { key: "evolution_api_url", value: evoUrl },
        { key: "evolution_api_key", value: evoKey },
        { key: "apollo_api_key", value: apolloKey },
      ];

      // Upsert each setting
      for (const p of pairs) {
        const { data: existing } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", p.key)
          .maybeSingle();

        if (existing) {
          await supabase.from("app_settings").update({ value: p.value, updated_at: now }).eq("key", p.key);
        } else {
          await supabase.from("app_settings").insert({ key: p.key, value: p.value });
        }
      }
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  }, [evoUrl, evoKey, apolloKey]);

  const handleNext = async () => {
    await saveSettings();
    if (activeStep < STEPS.length - 1) {
      setDirection(1);
      setActiveStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setDirection(-1);
      setActiveStep((s) => s - 1);
    }
  };

  const handleSkip = async () => {
    await saveSettings();
    if (activeStep < STEPS.length - 1) {
      setDirection(1);
      setActiveStep((s) => s + 1);
    }
  };

  const handleComplete = async () => {
    await saveSettings();
    // Mark wizard as completed
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", "setup_wizard_completed")
      .maybeSingle();
    if (existing) {
      await supabase.from("app_settings").update({ value: "true" }).eq("key", "setup_wizard_completed");
    } else {
      await supabase.from("app_settings").insert({ key: "setup_wizard_completed", value: "true" });
    }

    confetti({ particleCount: 200, spread: 100, origin: { y: 0.7 }, zIndex: 9999 });
    toast.success("Configuração concluída! Bem-vindo ao Evo Disparo.");
    onClose();
  };

  const progressPercentage = ((activeStep + 1) / STEPS.length) * 100;
  const currentStep = STEPS[activeStep];
  const showSkip = currentStep?.optional;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <StepEvolution apiUrl={evoUrl} apiKey={evoKey} onApiUrlChange={setEvoUrl} onApiKeyChange={setEvoKey} />;
      case 1:
        return <StepInstance evoUrl={evoUrl} evoKey={evoKey} />;
      case 2:
        return <StepApollo apiKey={apolloKey} onApiKeyChange={setApolloKey} />;
      case 3:
        return <StepFinish steps={STEPS} onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70"
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pt-7 border-b border-border">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2 rounded-lg bg-primary/10 border border-primary/20"
                animate={{ boxShadow: ["0 0 0px hsl(var(--primary)/0.3)", "0 0 15px hsl(var(--primary)/0.4)", "0 0 0px hsl(var(--primary)/0.3)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Settings2 className="w-5 h-5 text-primary" />
              </motion.div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Configuração Inicial</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">Passo</span>
                  <motion.span key={activeStep} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-sm font-semibold text-primary">
                    {activeStep + 1}
                  </motion.span>
                  <span className="text-sm text-muted-foreground">de {STEPS.length}</span>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Step indicators */}
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-center max-w-lg mx-auto">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <StepCircle
                    index={index}
                    activeStep={activeStep}
                    isOptional={step.optional}
                    onClick={() => { setDirection(index > activeStep ? 1 : -1); setActiveStep(index); }}
                  />
                  {index < STEPS.length - 1 && <ConnectingLine isCompleted={index < activeStep} />}
                </React.Fragment>
              ))}
            </div>
            <div className="text-center mt-3">
              <motion.span key={activeStep} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium text-primary">
                {currentStep?.title}
                {showSkip && <span className="text-muted-foreground font-normal ml-2">(opcional)</span>}
              </motion.span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 overflow-x-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 200, damping: 25 }, opacity: { duration: 0.3 }, scale: { duration: 0.3 }, filter: { duration: 0.3 } }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          {activeStep < STEPS.length - 1 && (
            <div className="flex items-center justify-between p-6 border-t border-border bg-card">
              <Button variant="ghost" onClick={handlePrev} disabled={activeStep === 0} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>

              <AnimatePresence>
                {isSaving && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Salvando...
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                {showSkip && (
                  <Button variant="ghost" onClick={handleSkip} disabled={isSaving} className="gap-2 text-muted-foreground">
                    Pular <SkipForward className="w-4 h-4" />
                  </Button>
                )}
                <Button onClick={handleNext} disabled={isSaving} className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40">
                  Próximo <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
