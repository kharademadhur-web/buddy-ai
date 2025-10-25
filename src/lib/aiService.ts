import { supabase } from './supabase';
import { EmotionType } from '../types';

// Backend API base URL configurable via env; defaults to local server
const API_BASE = (import.meta as any).env?.VITE_API_BASE || (window as any)?.VITE_API_BASE || 'http://localhost:8000';

interface AIResponse {
  message: string;
  emotion: EmotionType;
  emotionConfidence: number;
}

interface StreamingAIResponse {
  onToken: (token: string) => void;
  onComplete: (fullMessage: string) => void;
  onError: (error: string) => void;
}

export class AIService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async loadContext() {
    const [profile, memories, recentConversations] = await Promise.all([
      this.getUserProfile(),
      this.getUserMemories(),
      this.getRecentConversations(10)
    ]);

    return { profile, memories, recentConversations };
  }

  private async getUserProfile() {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();

    return data;
  }

  private async getUserMemories() {
    const { data } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', this.userId)
      .order('importance', { ascending: false })
      .limit(20);

    return data || [];
  }

  private async getRecentConversations(limit: number) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  detectEmotion(text: string): { emotion: EmotionType; confidence: number } {
    const emotionKeywords = {
      joy: ['happy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'awesome', 'fantastic', 'yay', '😊', '😄', '🎉'],
      sadness: ['sad', 'depressed', 'down', 'unhappy', 'miserable', 'crying', 'hurt', 'lonely', '😢', '😭', '💔'],
      anger: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate', 'irritated', 'pissed', '😠', '😡', '🤬'],
      fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified', 'panic', 'fearful', '😨', '😰', '😱'],
      surprise: ['wow', 'surprised', 'shocked', 'amazed', 'unexpected', 'incredible', 'unbelievable', '😮', '😲', '🤯']
    };

    const lowerText = text.toLowerCase();
    let maxScore = 0;
    let detectedEmotion: EmotionType = 'neutral';

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword.toLowerCase())).length;
      const score = matches / keywords.length;

      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion as EmotionType;
      }
    }

    const confidence = Math.min(maxScore * 2, 1);
    return { emotion: detectedEmotion, confidence };
  }

  async sendMessageStream(userMessage: string, callbacks: StreamingAIResponse): Promise<void> {
    const { emotion, confidence } = this.detectEmotion(userMessage);

    // Store user message
    await supabase.from('conversations').insert({
      user_id: this.userId,
      role: 'user',
      content: userMessage,
      emotion_detected: emotion,
      emotion_confidence: confidence
    });

    // Store emotion if significant
    if (emotion !== 'neutral' && confidence > 0.3) {
      await supabase.from('emotion_history').insert({
        user_id: this.userId,
        emotion,
        intensity: confidence,
        trigger_context: userMessage
      });
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: this.userId,
          context: []
        })
      });

      if (!response.ok) {
        throw new Error('Streaming API request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let fullMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                callbacks.onError(data.error);
                return;
              }
              
              if (data.token) {
                fullMessage += data.token;
                callbacks.onToken(data.token);
              }
              
              if (data.done) {
                // Store AI response
                await supabase.from('conversations').insert({
                  user_id: this.userId,
                  role: 'assistant',
                  content: fullMessage,
                  emotion_detected: 'neutral',
                  emotion_confidence: 0
                });

                this.extractAndStoreMemories(userMessage);
                callbacks.onComplete(fullMessage);
                return;
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming AI Service Error:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async sendMessage(userMessage: string): Promise<AIResponse> {
    const { emotion, confidence } = this.detectEmotion(userMessage);
    const context = await this.loadContext();

    await supabase.from('conversations').insert({
      user_id: this.userId,
      role: 'user',
      content: userMessage,
      emotion_detected: emotion,
      emotion_confidence: confidence
    });

    if (emotion !== 'neutral' && confidence > 0.3) {
      await supabase.from('emotion_history').insert({
        user_id: this.userId,
        emotion,
        intensity: confidence,
        trigger_context: userMessage
      });
    }

    // const systemPrompt = this.buildSystemPrompt(context.profile, context.memories);
    const conversationContext = context.recentConversations
      .reverse()
      .map(c => ({ role: c.role, content: c.content }))
      .slice(-10);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: this.userId,
          context: conversationContext
        })
      });

      if (!response.ok) {
        throw new Error('Local AI API request failed');
      }

      const data = await response.json();
      const aiMessage = data.response;

      await supabase.from('conversations').insert({
        user_id: this.userId,
        role: 'assistant',
        content: aiMessage,
        emotion_detected: 'neutral',
        emotion_confidence: 0
      });

      this.extractAndStoreMemories(userMessage);

      return {
        message: aiMessage,
        emotion,
        emotionConfidence: confidence
      };
    } catch (error) {
      console.error('Local AI Service Error:', error);
      return {
        message: this.getFallbackResponse(emotion),
        emotion,
        emotionConfidence: confidence
      };
    }
  }


  private async extractAndStoreMemories(userMessage: string) {
    const patterns = [
      { regex: /my name is (\w+)/i, type: 'fact', importance: 9 },
      { regex: /i (love|like|enjoy|prefer) (.*?)(\.|$)/i, type: 'preference', importance: 7 },
      { regex: /i (hate|dislike|can't stand) (.*?)(\.|$)/i, type: 'preference', importance: 7 },
      { regex: /my (goal|dream|aspiration) is (.*?)(\.|$)/i, type: 'fact', importance: 8 },
      { regex: /i (work as|am a) (.*?)(\.|$)/i, type: 'fact', importance: 8 }
    ];

    for (const pattern of patterns) {
      const match = userMessage.match(pattern.regex);
      if (match) {
        const content = match[0];

        const { data: existing } = await supabase
          .from('user_memory')
          .select('id')
          .eq('user_id', this.userId)
          .eq('content', content)
          .maybeSingle();

        if (!existing) {
          await supabase.from('user_memory').insert({
            user_id: this.userId,
            memory_type: pattern.type as 'fact' | 'preference',
            content,
            importance: pattern.importance
          });
        }
      }
    }
  }

  private getFallbackResponse(emotion: EmotionType): string {
    const responses = {
      joy: "That's wonderful! I'm so happy for you! 😊",
      sadness: "I'm here for you. It's okay to feel this way, and I'm listening. 💙",
      anger: "I understand you're frustrated. Take a deep breath. Want to talk about it?",
      fear: "It's natural to feel worried. I'm here with you. What's on your mind?",
      surprise: "Wow, that sounds unexpected! Tell me more about what happened.",
      neutral: "I'm here and listening. What would you like to talk about?"
    };

    return responses[emotion];
  }
}