import { EmotionType } from '../types';
import { Heart, Frown, Flame, AlertTriangle, Sparkles, Minus } from 'lucide-react';

interface EmotionIndicatorProps {
  emotion: EmotionType;
  confidence: number;
}

const emotionData = {
  joy: { icon: Heart, color: 'text-yellow-400', bg: 'bg-yellow-400/20', label: 'Joyful' },
  sadness: { icon: Frown, color: 'text-blue-400', bg: 'bg-blue-400/20', label: 'Sad' },
  anger: { icon: Flame, color: 'text-red-400', bg: 'bg-red-400/20', label: 'Frustrated' },
  fear: { icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-400/20', label: 'Worried' },
  surprise: { icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-400/20', label: 'Surprised' },
  neutral: { icon: Minus, color: 'text-gray-400', bg: 'bg-gray-400/20', label: 'Neutral' }
};

export const EmotionIndicator = ({ emotion, confidence }: EmotionIndicatorProps) => {
  if (emotion === 'neutral' || confidence < 0.3) return null;

  const data = emotionData[emotion];
  const Icon = data.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${data.bg} border border-current/20 animate-fade-in`}>
      <Icon className={`w-4 h-4 ${data.color}`} />
      <span className={`text-xs font-medium ${data.color}`}>
        {data.label}
      </span>
      <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${data.color.replace('text-', 'bg-')} transition-all duration-500`}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
    </div>
  );
};