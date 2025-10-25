import React from 'react';

interface FooterProps {
  onOpenHelp: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenHelp, onOpenPrivacy, onOpenTerms }) => {
  return (
    <footer className="border-t border-gray-800 bg-gray-900/60 px-6 py-3" role="contentinfo">
      <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-400">
        <div className="space-x-4">
          <button className="hover:text-white underline underline-offset-2" onClick={onOpenHelp} aria-label="Open Help and FAQ">Help</button>
          <button className="hover:text-white underline underline-offset-2" onClick={onOpenPrivacy} aria-label="Open Privacy Policy">Privacy</button>
          <button className="hover:text-white underline underline-offset-2" onClick={onOpenTerms} aria-label="Open Terms of Service">Terms</button>
        </div>
        <div>© {new Date().getFullYear()} Buddy AI</div>
      </div>
    </footer>
  );
};