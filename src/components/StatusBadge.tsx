import { cn } from "@/lib/utils";

type Status = "active" | "paused" | "completed" | "draft" | "error";

const statusConfig: Record<Status, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-success/15 text-success" },
  paused: { label: "Pausada", className: "bg-warning/15 text-warning" },
  completed: { label: "Concluída", className: "bg-info/15 text-info" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  error: { label: "Erro", className: "bg-destructive/15 text-destructive" },
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn("badge-status", config.className)}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "active" ? "pulse-dot" : "bg-current opacity-60"
      )} />
      {config.label}
    </span>
  );
}
