export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  personality_traits: Record<string, unknown>;
  preferences: Record<string, unknown>;
  goals: string[];
  challenges: string[];
  communication_style: 'casual' | 'professional' | 'empathetic' | 'balanced';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion_detected: EmotionType;
  emotion_confidence: number;
  context_data: Record<string, unknown>;
  created_at: string;
}

export type EmotionType = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';

export interface EmotionHistory {
  id: string;
  user_id: string;
  emotion: EmotionType;
  intensity: number;
  trigger_context: string;
  response_given: string;
  created_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  memory_type: 'fact' | 'preference' | 'event' | 'relationship';
  content: string;
  importance: number;
  last_accessed: string;
  created_at: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  emotion?: EmotionType;
  timestamp: Date;
}