import { CheckCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface StepFinishProps {
  steps: { id: string; title: string }[];
  onComplete: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StepFinish({ steps, onComplete }: StepFinishProps) {
  return (
    <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30 flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 0px hsl(var(--primary)/0.3)", "0 0 30px hsl(var(--primary)/0.5)", "0 0 0px hsl(var(--primary)/0.3)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-10 h-10 text-primary" />
        </motion.div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Tudo Pronto!</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Sua plataforma está configurada e pronta para uso. Você pode alterar essas configurações a qualquer momento em Configurações.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="max-w-sm mx-auto space-y-3">
        {steps.slice(0, -1).map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
          >
            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm text-foreground">{step.title}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="text-center pt-4">
        <Button
          size="lg"
          onClick={onComplete}
          className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all px-8"
        >
          <Sparkles className="w-4 h-4" />
          Começar a Usar
        </Button>
      </motion.div>
    </motion.div>
  );
}
