import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/monopoly';
import { Send, Smile, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface ChatBoxProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const QUICK_PHRASES = [
  'Đại gia mua hết đất rồi! 🤑',
  'Cháy túi rồi cứu với! 😭',
  'Vào tù vui vẻ nhé bác! 👮',
  'Đừng đi vào đất của tôi! ⚠️',
  'Gieo xúc xắc kép đỉnh cao! 🎲',
  'Cho vay tí tiền đê bạn hiền! 🤝',
];

export const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  soundEnabled,
  onToggleSound,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQuickPhrases, setShowQuickPhrases] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
    setShowQuickPhrases(false);
  };

  const handleQuickPhrase = (phrase: string) => {
    onSendMessage(phrase);
    setShowQuickPhrases(false);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#fffdf5] border-2 border-stone-300 shadow-lg overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#1e293b] text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span className="font-extrabold text-sm">Trò Chuyện & Nhật Ký</span>
        </div>
        <button
          onClick={onToggleSound}
          className="p-1 rounded-md hover:bg-white/20 transition-colors text-slate-300 hover:text-white"
          title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-stone-400 italic">
            Chưa có tin nhắn nào. Hãy gửi lời chào đến mọi người!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span
                  className="font-bold text-[10px] mb-0.5 px-1 rounded-xs"
                  style={{ color: msg.senderColor || '#3b82f6' }}
                >
                  {isMe ? 'Bạn' : msg.senderName}
                </span>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words shadow-xs ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-stone-100 text-stone-900 border border-stone-200 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick phrases drawer */}
      {showQuickPhrases && (
        <div className="p-2 bg-stone-100 border-t border-stone-200 grid grid-cols-2 gap-1 animate-in slide-in-from-bottom-2">
          {QUICK_PHRASES.map((phrase, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPhrase(phrase)}
              className="text-left text-[11px] p-1.5 rounded bg-white hover:bg-amber-50 text-stone-800 border border-stone-200 truncate font-medium cursor-pointer"
            >
              {phrase}
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSend} className="p-2 bg-white border-t border-stone-200 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowQuickPhrases((v) => !v)}
          className="p-1.5 text-stone-500 hover:text-amber-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          title="Câu thoại nhanh"
        >
          <Smile className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-3 py-1.5 bg-stone-100 text-stone-900 text-xs rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          maxLength={200}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
