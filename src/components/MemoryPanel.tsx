import { useState, useEffect } from 'react';
import { Brain, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserMemory } from '../types';

interface MemoryPanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryPanel = ({ userId, isOpen, onClose }: MemoryPanelProps) => {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMemories = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .order('importance', { ascending: false })
        .limit(50);

      setMemories(data || []);
    } catch (error) {
      console.error('Error loading memories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const memoryTypeColors = {
    fact: 'bg-blue-500/20 text-blue-400',
    preference: 'bg-purple-500/20 text-purple-400',
    event: 'bg-green-500/20 text-green-400',
    relationship: 'bg-pink-500/20 text-pink-400'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Memory Bank</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading memories...</div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No memories yet. Start chatting to build your memory bank!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        memoryTypeColors[memory.memory_type]
                      }`}
                    >
                      {memory.memory_type}
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: memory.importance }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed">{memory.content}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(memory.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};