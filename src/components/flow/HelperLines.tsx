import { useEffect, useRef } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";

interface HelperLinesProps {
  horizontal?: number;
  vertical?: number;
}

const storeSelector = (s: ReactFlowState) => ({
  transform: s.transform,
  width: s.width,
  height: s.height,
});

export default function HelperLines({ horizontal, vertical }: HelperLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { transform, width, height } = useStore(storeSelector);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (horizontal === undefined && vertical === undefined) return;

    const [tx, ty, zoom] = transform;

    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "hsl(142, 60%, 45%)";

    if (typeof horizontal === "number") {
      const y = horizontal * zoom + ty;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (typeof vertical === "number") {
      const x = vertical * zoom + tx;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [horizontal, vertical, transform, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 50 }}
    />
  );
}
