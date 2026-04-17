import { useCallback, useRef, useState } from "react";
import { type Node, type Edge } from "@xyflow/react";

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo() {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    past.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void
    ) => {
      const prev = past.current.pop();
      if (!prev) return;

      future.current.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });

      setNodes(prev.nodes);
      setEdges(prev.edges);
      setCanUndo(past.current.length > 0);
      setCanRedo(true);
    },
    []
  );

  const redo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void
    ) => {
      const next = future.current.pop();
      if (!next) return;

      past.current.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });

      setNodes(next.nodes);
      setEdges(next.edges);
      setCanUndo(true);
      setCanRedo(future.current.length > 0);
    },
    []
  );

  return { takeSnapshot, undo, redo, canUndo, canRedo };
}
