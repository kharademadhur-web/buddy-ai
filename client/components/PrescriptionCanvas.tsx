import { useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrescriptionCanvasProps {
  value: string;
  onChange: (value: string) => void;
  isRecording?: boolean;
}

export default function PrescriptionCanvas({
  value,
  onChange,
  isRecording = false,
}: PrescriptionCanvasProps) {
  const [recordingTime, setRecordingTime] = useState(0);

  // Simulate voice recording
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

  return (
    <div className="space-y-4">
      {/* Canvas Area */}
      <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write clinical notes here... or use voice recording below"
          className="w-full h-64 p-6 font-mono text-sm focus:outline-none resize-none"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {/* Voice Recording */}
        <button
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

        {/* Clear */}
        <button
          onClick={() => onChange("")}
          className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-5 h-5" />
          Clear
        </button>
      </div>

      {/* Info */}
      <p className="text-xs text-gray-500">
        💡 Tip: Click "Start Voice Recording" to simulate voice input. It will auto-generate a summary.
      </p>
    </div>
  );
}
