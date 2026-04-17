import { useEffect, useRef } from "react";
import { MessageSquare, Clock, GitFork, Brain, Zap, List } from "lucide-react";

const nodeOptions = [
  { type: "message", label: "Mensagem", icon: MessageSquare, color: "text-blue-500" },
  { type: "delay", label: "Intervalo", icon: Clock, color: "text-amber-500" },
  { type: "condition", label: "Condição", icon: GitFork, color: "text-purple-500" },
  { type: "ai", label: "IA", icon: Brain, color: "text-pink-500" },
  { type: "action", label: "Ação", icon: Zap, color: "text-orange-500" },
  { type: "switch", label: "Switch", icon: List, color: "text-teal-500" },
];

export interface InsertNodeMenuProps {
  x: number;
  y: number;
  onSelect: (type: string) => void;
  onClose: () => void;
}

export default function InsertNodeMenu({ x, y, onSelect, onClose }: InsertNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[170px] rounded-lg border bg-popover text-popover-foreground shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Inserir node</p>
      {nodeOptions.map((opt) => (
        <button
          key={opt.type}
          onClick={() => { onSelect(opt.type); onClose(); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
        >
          <opt.icon className={`w-4 h-4 ${opt.color}`} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
