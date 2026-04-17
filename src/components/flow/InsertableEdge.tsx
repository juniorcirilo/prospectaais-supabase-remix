import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useState, useCallback } from "react";

export default function InsertableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
  } = props;
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const onInsert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("flow-edge-insert", { detail: { edgeId: id, clientX: e.clientX, clientY: e.clientY } }));
  }, [id]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("flow-edge-context", { detail: { edgeId: id, clientX: e.clientX, clientY: e.clientY } }));
  }, [id]);

  return (
    <g>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={25}
        onContextMenu={onContextMenu}
        style={{ cursor: "pointer" }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <foreignObject
        x={labelX - 30}
        y={labelY - 30}
        width={60}
        height={60}
        style={{ overflow: "visible" }}
      >
        <div
          className="flex items-center justify-center w-full h-full"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {hovered ? (
            <button
              className="flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border text-muted-foreground shadow-md hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all cursor-pointer"
              onClick={onInsert}
              onContextMenu={onContextMenu}
              title="Inserir node"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-3 h-3 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
          )}
        </div>
      </foreignObject>
    </g>
  );
}
