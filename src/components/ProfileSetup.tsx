import { useState } from 'react';
import { UserProfile } from '../types';
import { User, Sparkles } from 'lucide-react';

interface ProfileSetupProps {
  profile: UserProfile | null;
  onComplete: (name: string, style: UserProfile['communication_style']) => void;
}

export const ProfileSetup = ({ profile, onComplete }: ProfileSetupProps) => {
  const [name, setName] = useState(profile?.name || '');
  const [style, setStyle] = useState<UserProfile['communication_style']>(
    profile?.communication_style || 'balanced'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim(), style);
    }
  };

  const styles: Array<{ value: UserProfile['communication_style']; label: string; description: string }> = [
    { value: 'casual', label: 'Casual', description: 'Friendly and relaxed' },
    { value: 'professional', label: 'Professional', description: 'Structured and focused' },
    { value: 'empathetic', label: 'Empathetic', description: 'Deeply understanding' },
    { value: 'balanced', label: 'Balanced', description: 'Mix of all styles' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-to-br from-cyan-500 to-blue-500 p-4 rounded-full">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">Welcome to Buddy AI</h1>
        <p className="text-gray-400 text-center mb-8">Let's get to know each other</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What's your name?
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-gray-900/50 text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              How should I communicate?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {styles.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    style === s.value
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white ring-2 ring-cyan-400'
                      : 'bg-gray-900/50 text-gray-300 hover:bg-gray-900/70 border border-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className={`text-xs ${style === s.value ? 'text-white/80' : 'text-gray-500'}`}>
                    {s.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 rounded-xl transition-all transform hover:scale-105"
          >
            Let's Chat
          </button>
        </form>
      </div>
    </div>
  );
};