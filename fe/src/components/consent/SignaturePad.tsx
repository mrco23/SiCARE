import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, CheckCircle2 } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  width = 500,
  height = 180,
  strokeColor = "#0f172a",
  strokeWidth = 2.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Background: clean white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    setHasStrokes(false);
    setPointCount(0);
    onSignatureChange(null);
  }, [width, height, strokeColor, strokeWidth, onSignatureChange]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setPointCount((prev) => prev + 1);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    setPointCount((prev) => prev + 1);
    if (!hasStrokes) {
      setHasStrokes(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }

    // Validate that we have sufficient strokes
    if (pointCount > 5) {
      const dataUrl = canvas.toDataURL("image/png");
      onSignatureChange(dataUrl);
    } else {
      onSignatureChange(null);
    }
  };

  const handleClear = () => {
    initCanvas();
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative border-2 border-dashed border-slate-300 hover:border-emerald-700/60 rounded-xl bg-white overflow-hidden shadow-inner transition-colors">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: `${height}px`, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="cursor-crosshair block"
        />

        {!hasStrokes && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
            <span className="text-sm font-medium">Beri tanda tangan di sini</span>
            <span className="text-xs text-slate-400 mt-1">Gunakan mouse, layar sentuh, atau stylus</span>
          </div>
        )}

        {hasStrokes && (
          <div className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tanda tangan terdeteksi</span>
          </div>
        )}
      </div>

      <div className="w-full flex items-center justify-between mt-2.5 text-xs text-slate-500">
        <span>Format: PNG (24-bit raster)</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasStrokes}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hapus / Ulangi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default SignaturePad;
