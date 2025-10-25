import { X, HelpCircle } from 'lucide-react';
import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-cyan-400" />
            <h2 id="help-title" className="text-xl font-bold text-white">Help & FAQ</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close help modal">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)] space-y-4 text-gray-200 text-sm">
          <div>
            <h3 className="text-white font-semibold">What is Buddy AI?</h3>
            <p>Buddy is an AI companion that can chat, remember important details, and respond with empathy.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold">How does memory work?</h3>
            <p>Buddy stores key facts and preferences you share. View them in the Memory Bank. You can clear chat anytime.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold">Is my data private?</h3>
            <p>Your data is stored in your connected Supabase project. See the Privacy Policy for details.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold">Troubleshooting</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>If responses fail, ensure the backend is running at http://localhost:8000</li>
              <li>Check your .env has valid Supabase keys</li>
              <li>Check GROQ_API_KEY is set for the backend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};