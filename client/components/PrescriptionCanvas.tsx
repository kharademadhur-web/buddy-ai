import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Eraser, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, apiErrorMessage } from "@/lib/api-base";
import { toast } from "sonner";

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
  /** Live + final voice output for saving on consultation complete */
  onVoiceOutput?: (o: { transcript: string; englishPhrase: string }) => void;
  /** Hide stylus pad by default — focus on patient + voice + meds */
  showHandwriting?: boolean;
}

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};

export default function PrescriptionCanvas({
  value,
  onChange,
  isRecording: _legacyRecording,
  onHandwritingChange,
  onVoiceOutput,
  showHandwriting = false,
}: PrescriptionCanvasProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<HandwritingStrokeBundle["lines"]>([]);
  const drawingRef = useRef<{ points: [number, number][] } | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const finalTranscriptRef = useRef("");
  const finalSegmentsRef = useRef<string[]>([]);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [englishPhrase, setEnglishPhrase] = useState("");
  const [consent, setConsent] = useState(true);

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

  const pushVoiceToParent = useCallback(
    (transcript: string, phrase: string) => {
      onVoiceOutput?.({ transcript: transcript.trim(), englishPhrase: phrase.trim() });
    },
    [onVoiceOutput]
  );

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const finalizeWithSummary = useCallback(async () => {
    const text = liveTranscript.trim() || finalTranscriptRef.current.trim();
    stopRecognition();
    if (!text) {
      setEnglishPhrase("");
      pushVoiceToParent("", "");
      return;
    }
    if (!consent) {
      toast.error("Enable recording consent to generate an English summary.");
      pushVoiceToParent(text, "");
      return;
    }
    setSummarizing(true);
    try {
      const res = await apiFetch("/api/ai/consultation-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, recordingConsent: true as const }),
      });
      const j = (await res.json()) as {
        success?: boolean;
        summary?: { englishPhrase?: string; chiefComplaint?: string; plan?: string };
      };
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Summary failed");
      const phrase =
        j.summary?.englishPhrase ||
        [j.summary?.chiefComplaint, j.summary?.plan].filter(Boolean).join(" — ").slice(0, 400) ||
        "";
      setEnglishPhrase(phrase);
      pushVoiceToParent(text, phrase);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize");
      pushVoiceToParent(text, "");
    } finally {
      setSummarizing(false);
    }
  }, [consent, liveTranscript, pushVoiceToParent, stopRecognition]);

  const startRecording = useCallback(() => {
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : undefined;
    const SR = (win?.SpeechRecognition || win?.webkitSpeechRecognition) as
      | (new () => SpeechRec)
      | undefined;
    if (!SR) {
      toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    finalTranscriptRef.current = "";
    finalSegmentsRef.current = [];
    setLiveTranscript("");
    setEnglishPhrase("");

    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev: Event) => {
      const e = ev as unknown as {
        resultIndex: number;
        results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
      };
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          finalSegmentsRef.current[i] = t;
        } else {
          interim += (interim ? " " : "") + t;
        }
      }
      finalTranscriptRef.current = finalSegmentsRef.current.filter(Boolean).join(" ").trim();
      const full = [finalTranscriptRef.current, interim.trim()].filter(Boolean).join(" ").trim();
      setLiveTranscript(full);
    };

    rec.onerror = () => {
      toast.error("Voice recognition error — try again.");
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((s) => s + 1), 1000);
    } catch {
      toast.error("Could not start microphone.");
    }
  }, []);

  const clearHandwriting = () => {
    drawingRef.current = null;
    setLines([]);
    emitHandwriting([]);
    redraw([], null);
  };

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1">
          Brief clinical notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Short findings, differentials, or reminders — voice captures the live conversation below."
            className="w-full h-36 p-4 font-sans text-sm focus:outline-none resize-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <input
            id="consent-voice"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="consent-voice" className="text-xs text-gray-700 leading-snug">
            I consent to capture this visit conversation for the clinical record and English summary. Required for
            summary generation.
          </label>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">Conversation (voice)</p>
          <p className="text-xs text-gray-600 mb-2">
            Starting a new recording clears the previous conversation for this patient. Speak clearly; text appears
            live. Stop when finished to generate a short English line below.
          </p>
          <div className="min-h-[100px] max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap">
            {liveTranscript || (
              <span className="text-gray-400">Conversation transcript will appear here…</span>
            )}
          </div>
        </div>

        {englishPhrase ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">English summary</p>
            <p className="text-sm text-emerald-950 mt-1">{englishPhrase}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (isRecording) return;
              finalTranscriptRef.current = "";
              finalSegmentsRef.current = [];
              setLiveTranscript("");
              setEnglishPhrase("");
              startRecording();
            }}
            disabled={isRecording || summarizing}
            className={cn(
              "flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all",
              "bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
            )}
          >
            <Mic className="w-5 h-5" />
            Start recording
          </button>

          <button
            type="button"
            onClick={() => void finalizeWithSummary()}
            disabled={summarizing || (!liveTranscript.trim() && !isRecording)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-lg font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {summarizing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Summarizing…
              </>
            ) : (
              <>
                <Square className="w-5 h-5" />
                Stop &amp; summarize
              </>
            )}
          </button>
        </div>
        {isRecording ? (
          <p className="text-xs font-medium text-violet-800">
            Microphone on · {recordingTime}s elapsed — speak naturally, then press Stop &amp; summarize.
          </p>
        ) : null}
      </div>

      {showHandwriting && onHandwritingChange ? (
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
            Draw Rx here if you use a stylus; notes and medicines still save the visit if you skip drawing.
          </p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear notes
        </button>
      </div>
    </div>
  );
}
