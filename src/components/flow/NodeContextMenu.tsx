import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, CopyPlus, PencilLine } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface NodeContextMenuProps {
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
  onCopy: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onRename: (nodeId: string, newLabel: string) => void;
  onClose: () => void;
}

export default function NodeContextMenu({
  nodeId,
  nodeLabel,
  x,
  y,
  onCopy,
  onDuplicate,
  onRename,
  onClose,
}: NodeContextMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(nodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleRenameSubmit = useCallback(() => {
    if (name.trim()) {
      onRename(nodeId, name.trim());
    }
    onClose();
  }, [name, nodeId, onRename, onClose]);

  const items = [
    { label: "Copiar", icon: Copy, action: () => { onCopy(nodeId); onClose(); } },
    { label: "Duplicar", icon: CopyPlus, action: () => { onDuplicate(nodeId); onClose(); } },
    { label: "Renomear", icon: PencilLine, action: () => setRenaming(true) },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-lg border bg-popover text-popover-foreground shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      {renaming ? (
        <div className="px-2 py-1.5">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") onClose();
            }}
            onBlur={handleRenameSubmit}
            className="h-8 text-sm"
            placeholder="Nome do node"
          />
        </div>
      ) : (
        items.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
          >
            <item.icon className="w-4 h-4 text-muted-foreground" />
            {item.label}
          </button>
        ))
      )}
    </div>
  );
}
