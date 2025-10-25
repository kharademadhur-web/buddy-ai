import { X } from 'lucide-react';
import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

const privacy = `
Privacy Policy

We respect your privacy. Buddy AI stores conversation data in your connected database (Supabase) for the purpose of providing memory and improving your experience. We do not sell your data. You may request deletion of your data at any time.

What we store:
- Conversations you have with Buddy (content, timestamps)
- Emotion signals inferred from your messages
- Optional profile preferences

Your choices:
- Clear chat history at any time
- Export your conversations
- Disable memory features if desired

Security:
- Transport is encrypted over HTTPS when deployed
- Access is restricted to your account/project keys
`;

const terms = `
Terms of Service

By using Buddy AI, you agree to:
- Use the service responsibly and lawfully
- Not attempt to abuse, overload, or attack the system
- Understand AI output may be inaccurate; always verify critical information

Limitation of liability: Buddy AI is provided "as is" without warranties. The creators are not liable for damages arising from use.
`;

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;
  const content = type === 'privacy' ? privacy : terms;
  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 id="legal-title" className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close legal modal">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          <pre className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">{content}</pre>
        </div>
      </div>
    </div>
  );
};
