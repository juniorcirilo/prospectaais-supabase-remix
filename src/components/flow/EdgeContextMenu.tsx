import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

export interface EdgeContextMenuProps {
  edgeId: string;
  x: number;
  y: number;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

export default function EdgeContextMenu({ edgeId, x, y, onDelete, onClose }: EdgeContextMenuProps) {
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
      className="fixed z-[9999] min-w-[160px] rounded-lg border bg-popover text-popover-foreground shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => { onDelete(edgeId); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        Excluir conexão
      </button>
    </div>
  );
}
