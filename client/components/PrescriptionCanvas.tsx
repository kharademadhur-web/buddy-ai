import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

/** Serialized for POST /api/consultations/complete → handwritingStrokes */
export type HandwritingStrokeBundle = {
  version: 1;
  lines: Array<{ points: [number, number][] }>;
};

interface PrescriptionCanvasProps {
  value: string;
  onChange: (value: string) => void;
  isRecording?: boolean;
  /** When user draws on the pad; omit or null = no handwriting payload. */
  onHandwritingChange?: (strokes: HandwritingStrokeBundle | null) => void;
}

export default function PrescriptionCanvas({
  value,
  onChange,
  isRecording = false,
  onHandwritingChange,
}: PrescriptionCanvasProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<HandwritingStrokeBundle["lines"]>([]);
  const drawingRef = useRef<{ points: [number, number][] } | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const redraw = useCallback(
    (allLines: HandwritingStrokeBundle["lines"], active: { points: [number, number][] } | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const drawLine = (pts: [number, number][]) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      };
      for (const line of allLines) drawLine(line.points);
      if (active?.points?.length) drawLine(active.points);
    },
    []
  );

  const fitCanvas = useCallback(() => {
    const el = wrapRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const w = Math.max(200, el.clientWidth);
    const h = 160;
    canvas.width = w;
    canvas.height = h;
    redraw(linesRef.current, drawingRef.current);
  }, [redraw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    fitCanvas();
    const ro = new ResizeObserver(() => fitCanvas());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    redraw(lines, drawingRef.current);
  }, [lines, redraw]);

  const emitHandwriting = useCallback(
    (nextLines: HandwritingStrokeBundle["lines"]) => {
      if (!onHandwritingChange) return;
      if (nextLines.length === 0) {
        onHandwritingChange(null);
        return;
      }
      onHandwritingChange({ version: 1, lines: nextLines });
    },
    [onHandwritingChange]
  );

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const handleStartRecording = () => {
    setRecordingTime(0);
    const mockTranscription = `Patient presents with symptoms of cough, fever, and body aches. 
Physical examination reveals: temperature 101°F, mild congestion. 
Diagnosis: Upper respiratory tract infection. 
Recommended treatment: Rest, fluids, and prescribed medications. 
Follow-up in 3 days if symptoms persist.`;

    setTimeout(() => {
      onChange(value + (value ? "\n\n" : "") + mockTranscription);
      setRecordingTime(0);
    }, 2000);
  };

  const clearHandwriting = () => {
    drawingRef.current = null;
    setLines([]);
    emitHandwriting([]);
    redraw([], null);
  };

  return (
    <div className="space-y-4">
      {/* Structured notes — always work without handwriting */}
      <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write clinical notes here... or use voice recording below"
          className="w-full h-64 p-6 font-mono text-sm focus:outline-none resize-none"
        />
      </div>

      {/* Optional handwriting pad — strokes sent to API when completing */}
      {onHandwritingChange ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">Handwriting pad (optional)</p>
            <button
              type="button"
              onClick={clearHandwriting}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear pad
            </button>
          </div>
          <div ref={wrapRef} className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair block"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const p = toLocal(e);
                drawingRef.current = { points: [p] };
                redraw(linesRef.current, drawingRef.current);
              }}
              onPointerMove={(e) => {
                if (!drawingRef.current) return;
                const p = toLocal(e);
                drawingRef.current.points.push(p);
                redraw(linesRef.current, drawingRef.current);
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                const cur = drawingRef.current;
                drawingRef.current = null;
                if (!cur || cur.points.length < 2) {
                  redraw(linesRef.current, null);
                  return;
                }
                setLines((prev) => {
                  const next = [...prev, cur];
                  emitHandwriting(next);
                  queueMicrotask(() => redraw(next, null));
                  return next;
                });
              }}
              onPointerLeave={(e) => {
                if (drawingRef.current) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const cur = drawingRef.current;
                  drawingRef.current = null;
                  if (cur && cur.points.length >= 2) {
                    setLines((prev) => {
                      const next = [...prev, cur];
                      emitHandwriting(next);
                      queueMicrotask(() => redraw(next, null));
                      return next;
                    });
                  } else {
                    redraw(linesRef.current, null);
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            Draw Rx here if you use a stylus; structured notes and medicine table above still save the
            visit if you skip drawing.
          </p>
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleStartRecording}
          disabled={isRecording}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all",
            isRecording
              ? "bg-red-600 text-white animate-pulse"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          )}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5 animate-bounce" />
              Recording ({recordingTime}s)
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Voice Recording
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onChange("")}
          className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-5 h-5" />
          Clear
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Tip: Structured notes and medicines are enough to complete a visit; handwriting is optional.
      </p>
    </div>
  );
}
