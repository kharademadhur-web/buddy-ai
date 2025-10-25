import { Message, EmotionType } from '../types';
import { Heart, Frown, Flame, AlertTriangle, Sparkles, Minus, Bot, User, Copy, CheckCheck, Loader } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
}

const emotionIcons: Record<EmotionType, typeof Heart> = {
  joy: Heart,
  sadness: Frown,
  anger: Flame,
  fear: AlertTriangle,
  surprise: Sparkles,
  neutral: Minus
};

const emotionColors: Record<EmotionType, string> = {
  joy: 'text-yellow-400',
  sadness: 'text-blue-400',
  anger: 'text-red-400',
  fear: 'text-purple-400',
  surprise: 'text-pink-400',
  neutral: 'text-gray-400'
};

export const ChatMessage = ({ message, isStreaming = false, streamingContent }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const EmotionIcon = message.emotion ? emotionIcons[message.emotion] : null;
  const emotionColor = message.emotion ? emotionColors[message.emotion] : '';
  
  // Use streaming content if available, otherwise use message content
  const displayContent = isStreaming && streamingContent ? streamingContent : message.content;
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-700'
        }`}>
          {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-cyan-400" />}
        </div>
        
        {/* Message Content */}
        <div
          className={`rounded-2xl px-4 py-3 relative group ${
            isUser
              ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white'
              : 'bg-gray-800/50 backdrop-blur-sm text-gray-100 border border-gray-700/50'
          } shadow-lg`}
        >
          {/* Copy Button */}
          {!isUser && (
            <button
              onClick={copyToClipboard}
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 rounded-full p-1.5 shadow-md"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <CheckCheck className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3 text-gray-300" />
              )}
            </button>
          )}
          
          <div className="flex items-start gap-2">
            {/* Emotion Indicator */}
            {!isUser && EmotionIcon && (
              <div className="flex items-center gap-1 mb-1">
                <EmotionIcon className={`w-4 h-4 ${emotionColor}`} />
                {isStreaming && <Loader className="w-3 h-3 animate-spin text-cyan-400" />}
              </div>
            )}
            
            {/* Message Content with Markdown */}
            <div className="flex-1 min-w-0">
              {isUser ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={tomorrow}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md text-xs"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-gray-700 px-1 py-0.5 rounded text-xs" {...props}>
                            {children}
                          </code>
                        )
                      },
                      h1: ({children}) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                      h2: ({children}) => <h2 className="text-base font-semibold text-white mb-2">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
                      ul: ({children}) => <ul className="list-disc ml-4 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal ml-4 space-y-1">{children}</ol>,
                      li: ({children}) => <li className="text-sm text-gray-200">{children}</li>,
                      p: ({children}) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                      blockquote: ({children}) => (
                        <blockquote className="border-l-4 border-cyan-500 pl-3 my-2 text-gray-300 italic">
                          {children}
                        </blockquote>
                      ),
                      strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                  {/* Streaming cursor */}
                  {isStreaming && <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1" />}
                </div>
              )}
            </div>
          </div>
          
          {/* Timestamp */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600/30">
            <span className="text-xs opacity-60">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && message.emotion && (
              <span className="text-xs opacity-60 capitalize">{message.emotion}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
