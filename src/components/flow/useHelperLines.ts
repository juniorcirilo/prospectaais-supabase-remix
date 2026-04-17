import { useCallback, useState } from "react";
import { type Node, type NodeChange, applyNodeChanges } from "@xyflow/react";

const SNAP_THRESHOLD = 5;
const COLLISION_PADDING = 12;

interface HelperLineResult {
  helperLineH?: number;
  helperLineV?: number;
  applyChangesWithSnap: (changes: NodeChange[], nodes: Node[]) => Node[];
}

function getNodeRect(node: Node, overridePos?: { x: number; y: number }) {
  const x = overridePos ? overridePos.x : node.position.x;
  const y = overridePos ? overridePos.y : node.position.y;
  const w = node.measured?.width ?? 180;
  const h = node.measured?.height ?? 60;
  return { x, y, w, h, right: x + w, bottom: y + h };
}

function rectsOverlap(
  a: { x: number; y: number; right: number; bottom: number },
  b: { x: number; y: number; right: number; bottom: number },
  padding: number
) {
  return !(
    a.right + padding <= b.x ||
    b.right + padding <= a.x ||
    a.bottom + padding <= b.y ||
    b.bottom + padding <= a.y
  );
}

function resolveCollision(
  draggedRect: { x: number; y: number; w: number; h: number; right: number; bottom: number },
  otherRect: { x: number; y: number; w: number; h: number; right: number; bottom: number },
  padding: number
): { x: number; y: number } {
  // Calculate overlap on each axis
  const overlapLeft = draggedRect.right + padding - otherRect.x;
  const overlapRight = otherRect.right + padding - draggedRect.x;
  const overlapTop = draggedRect.bottom + padding - otherRect.y;
  const overlapBottom = otherRect.bottom + padding - draggedRect.y;

  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapLeft) return { x: otherRect.x - draggedRect.w - padding, y: draggedRect.y };
  if (minOverlap === overlapRight) return { x: otherRect.right + padding, y: draggedRect.y };
  if (minOverlap === overlapTop) return { x: draggedRect.x, y: otherRect.y - draggedRect.h - padding };
  return { x: draggedRect.x, y: otherRect.bottom + padding };
}

export function useHelperLines(): HelperLineResult {
  const [helperLineH, setHelperLineH] = useState<number | undefined>();
  const [helperLineV, setHelperLineV] = useState<number | undefined>();

  const applyChangesWithSnap = useCallback(
    (changes: NodeChange[], nodes: Node[]): Node[] => {
      let hLine: number | undefined;
      let vLine: number | undefined;

      const positionChange = changes.find(
        (c) => c.type === "position" && c.dragging && c.position
      );

      if (positionChange && positionChange.type === "position" && positionChange.position) {
        const draggedId = positionChange.id;
        const draggedNode = nodes.find((n) => n.id === draggedId);
        if (draggedNode) {
          const dWidth = draggedNode.measured?.width ?? 180;
          const dHeight = draggedNode.measured?.height ?? 60;

          // --- Collision detection ---
          let pos = { ...positionChange.position };
          const otherNodes = nodes.filter((n) => n.id !== draggedId);

          for (const other of otherNodes) {
            const draggedRect = getNodeRect(draggedNode, pos);
            const otherRect = getNodeRect(other);

            if (rectsOverlap(draggedRect, otherRect, COLLISION_PADDING)) {
              const resolved = resolveCollision(draggedRect, otherRect, COLLISION_PADDING);
              pos = resolved;
            }
          }

          positionChange.position.x = pos.x;
          positionChange.position.y = pos.y;

          // --- Snap / helper lines ---
          const dCenterX = pos.x + dWidth / 2;
          const dCenterY = pos.y + dHeight / 2;
          const dRight = pos.x + dWidth;
          const dBottom = pos.y + dHeight;

          let snapX: number | undefined;
          let snapY: number | undefined;
          let bestDx = SNAP_THRESHOLD;
          let bestDy = SNAP_THRESHOLD;

          for (const node of otherNodes) {
            const nWidth = node.measured?.width ?? 180;
            const nHeight = node.measured?.height ?? 60;
            const nCenterX = node.position.x + nWidth / 2;
            const nCenterY = node.position.y + nHeight / 2;
            const nRight = node.position.x + nWidth;
            const nBottom = node.position.y + nHeight;

            const xChecks = [
              { d: Math.abs(pos.x - node.position.x), snap: node.position.x, line: node.position.x },
              { d: Math.abs(dCenterX - nCenterX), snap: nCenterX - dWidth / 2, line: nCenterX },
              { d: Math.abs(dRight - nRight), snap: nRight - dWidth, line: nRight },
              { d: Math.abs(pos.x - nRight), snap: nRight, line: nRight },
              { d: Math.abs(dRight - node.position.x), snap: node.position.x - dWidth, line: node.position.x },
            ];

            for (const check of xChecks) {
              if (check.d < bestDx) {
                bestDx = check.d;
                snapX = check.snap;
                vLine = check.line;
              }
            }

            const yChecks = [
              { d: Math.abs(pos.y - node.position.y), snap: node.position.y, line: node.position.y },
              { d: Math.abs(dCenterY - nCenterY), snap: nCenterY - dHeight / 2, line: nCenterY },
              { d: Math.abs(dBottom - nBottom), snap: nBottom - dHeight, line: nBottom },
              { d: Math.abs(pos.y - nBottom), snap: nBottom, line: nBottom },
              { d: Math.abs(dBottom - node.position.y), snap: node.position.y - dHeight, line: node.position.y },
            ];

            for (const check of yChecks) {
              if (check.d < bestDy) {
                bestDy = check.d;
                snapY = check.snap;
                hLine = check.line;
              }
            }
          }

          // Only apply snap if it doesn't cause a new collision
          if (snapX !== undefined) {
            const testRect = getNodeRect(draggedNode, { x: snapX, y: positionChange.position.y });
            const wouldCollide = otherNodes.some((n) =>
              rectsOverlap(testRect, getNodeRect(n), COLLISION_PADDING)
            );
            if (!wouldCollide) positionChange.position.x = snapX;
            else vLine = undefined;
          }

          if (snapY !== undefined) {
            const testRect = getNodeRect(draggedNode, { x: positionChange.position.x, y: snapY });
            const wouldCollide = otherNodes.some((n) =>
              rectsOverlap(testRect, getNodeRect(n), COLLISION_PADDING)
            );
            if (!wouldCollide) positionChange.position.y = snapY;
            else hLine = undefined;
          }
        }
      }

      setHelperLineH(hLine);
      setHelperLineV(vLine);

      return applyNodeChanges(changes, nodes);
    },
    []
  );

  return { helperLineH, helperLineV, applyChangesWithSnap };
}
