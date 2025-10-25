import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, VolumeX } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isListening: boolean;
  isSpeaking: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  transcript: string;
  disabled?: boolean;
}

export const ChatInput = ({
  onSend,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  transcript,
  disabled
}: ChatInputProps) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = isListening ? transcript : input;

  // Auto-focus input field when not disabled
  useEffect(() => {
    if (!disabled && !isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, isListening]);

  const handleSend = () => {
    const message = displayValue.trim();
    if (message && !disabled) {
      onSend(message);
      setInput('');
      if (isListening) {
        onStopListening();
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      onStopListening();
      if (transcript.trim()) {
        setInput(transcript);
      }
    } else {
      onStartListening();
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-900/80 backdrop-blur-md p-4">
      <div className="flex gap-2 items-center">
        <button
          onClick={handleMicClick}
          className={`p-3 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          } text-white`}
          disabled={disabled}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isListening ? 'Listening...' : 'Type your message...'}
          disabled={disabled || isListening}
          className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 placeholder-gray-500"
          autoComplete="off"
          aria-label="Message input"
        />

        {isSpeaking && (
          <button
            onClick={onStopSpeaking}
            className="p-3 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all text-white animate-pulse"
            aria-label="Stop speaking"
          >
            <VolumeX className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={handleSend}
          disabled={!displayValue.trim() || disabled}
          className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {isListening && (
        <div className="mt-2 text-xs text-cyan-400 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Listening... Speak now
        </div>
      )}
    </div>
  );
};