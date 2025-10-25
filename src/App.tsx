import { useState, useEffect, useRef } from 'react';
import { useUserProfile } from './hooks/useUserProfile';
import { useVoice } from './hooks/useVoice';
import { AIService } from './lib/aiService';
import { ProfileSetup } from './components/ProfileSetup';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { EmotionIndicator } from './components/EmotionIndicator';
import { MemoryPanel } from './components/MemoryPanel';
import { Footer } from './components/Footer';
import { LegalModal } from './components/LegalModal';
import { HelpModal } from './components/HelpModal';
import { Message, EmotionType, UserProfile } from './types';
import { Brain, Sparkles, Settings, Trash2, Download } from 'lucide-react';

function App() {
  const { userId, profile, loading, updateProfile } = useUserProfile();
  const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking, isSupported } = useVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState<{ emotion: EmotionType; confidence: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiService, setAiService] = useState<AIService | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showLegal, setShowLegal] = useState<{open: boolean; type: 'privacy' | 'terms'}>({ open: false, type: 'privacy' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      setAiService(new AIService(userId));
    }
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleProfileComplete = async (name: string, style: UserProfile['communication_style']) => {
    await updateProfile({ name, communication_style: style });

    const welcomeMessage: Message = {
      role: 'assistant',
      content: `Hey ${name}! I'm Buddy, your AI companion. I'm here to chat, help you with tasks, and remember everything we talk about. How are you feeling today?`,
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);
    speak(welcomeMessage.content);
  };

  const handleSendMessage = async (content: string) => {
    if (!aiService || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    setErrorMsg(null);
    try {
      const response = await aiService.sendMessage(content);

      setCurrentEmotion({
        emotion: response.emotion,
        confidence: response.emotionConfidence
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        emotion: response.emotion,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, assistantMessage]);
      speak(response.message);
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMsg('Connection issue: please ensure the backend (http://localhost:8000) is running and reachable.');
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Buddy AI...</p>
        </div>
      </div>
    );
  }

  if (!profile?.name) {
    return <ProfileSetup profile={profile} onComplete={handleProfileComplete} />;
  }

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleExportChat = () => {
    const lines = messages.map(m => `[${m.timestamp.toLocaleString()}] ${m.role.toUpperCase()}: ${m.content}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buddy-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700 px-6 py-4" role="banner">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-500 p-2 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Buddy AI</h1>
              <p className="text-xs text-gray-400">Your intelligent companion</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentEmotion && (
              <EmotionIndicator
                emotion={currentEmotion.emotion}
                confidence={currentEmotion.confidence}
              />
            )}

            <button
              onClick={() => setShowMemoryPanel(true)}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
              title="View Memories"
              aria-label="View Memories"
            >
              <Brain className="w-5 h-5" />
            </button>

            <button
              onClick={handleClearChat}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
              title="Clear Conversation"
              aria-label="Clear Conversation"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button
              onClick={handleExportChat}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
              title="Export Conversation"
              aria-label="Export Conversation"
            >
              <Download className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
              title="Settings"
              aria-label="Open Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl w-full mx-auto">
        {errorMsg && (
          <div className="mx-6 mt-4 mb-0 bg-red-500/10 text-red-300 border border-red-500/30 rounded-xl px-4 py-2" role="alert">
            {errorMsg}
          </div>
        )}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Start a conversation with Buddy!</p>
              <p className="text-gray-500 text-sm mt-2">I remember everything and understand emotions</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))
          )}

          {isProcessing && (
            <div className="flex justify-start mb-4" aria-label="Buddy is typing" aria-live="polite">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl px-4 py-3 border border-gray-700">
                <div className="flex gap-2" role="status">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={handleSendMessage}
          isListening={isListening}
          isSpeaking={isSpeaking}
          onStartListening={startListening}
          onStopListening={stopListening}
          onStopSpeaking={stopSpeaking}
          transcript={transcript}
          disabled={isProcessing}
        />
      </main>

      <Footer
        onOpenHelp={() => setShowHelp(true)}
        onOpenPrivacy={() => setShowLegal({ open: true, type: 'privacy' })}
        onOpenTerms={() => setShowLegal({ open: true, type: 'terms' })}
      />

      <MemoryPanel
        userId={userId}
        isOpen={showMemoryPanel}
        onClose={() => setShowMemoryPanel(false)}
      />

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 id="settings-title" className="text-xl font-bold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  className="w-full bg-gray-900 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Communication Style</label>
                <select
                  value={profile.communication_style}
                  onChange={(e) => updateProfile({ communication_style: e.target.value as UserProfile['communication_style'] })}
                  className="w-full bg-gray-900 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="balanced">Balanced</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Voice: {isSupported ? '✓ Enabled' : '✗ Not supported in this browser'}
                </p>
                <p className="text-xs text-gray-500 mt-1">User ID: {userId}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <LegalModal isOpen={showLegal.open} onClose={() => setShowLegal({ open: false, type: 'privacy' })} type={showLegal.type} />
    </div>
  );
}

export default App;