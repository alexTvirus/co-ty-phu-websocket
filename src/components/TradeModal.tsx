import React, { useState } from 'react';
import { Player, GameState } from '../types/monopoly';
import { MONOPOLY_SPACES } from '../data/monopolyBoard';
import { X, ArrowRightLeft, Handshake, DollarSign } from 'lucide-react';

interface TradeModalProps {
  player: Player;
  gameState: GameState;
  onClose: () => void;
  onSendTradeMessage: (text: string) => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  player,
  gameState,
  onClose,
  onSendTradeMessage,
}) => {
  const otherPlayers = gameState.players.filter((p) => p.id !== player.id && !p.isBankrupt);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(otherPlayers[0]?.id || '');
  const [offerCash, setOfferCash] = useState<number>(100);
  const [requestCash, setRequestCash] = useState<number>(0);
  const [selectedMyProp, setSelectedMyProp] = useState<number | null>(null);
  const [selectedTheirProp, setSelectedTheirProp] = useState<number | null>(null);

  const partner = otherPlayers.find((p) => p.id === selectedPartnerId);

  const handleProposeTrade = () => {
    if (!partner) return;
    const myPropName = selectedMyProp !== null ? MONOPOLY_SPACES[selectedMyProp]?.name : 'Không kèm đất';
    const theirPropName = selectedTheirProp !== null ? MONOPOLY_SPACES[selectedTheirProp]?.name : 'Không kèm đất';

    const tradeMsg = `🤝 ĐỀ NGHỊ GIAO DỊCH với ${partner.name}: Tôi đưa [${offerCash}$ + ${myPropName}] để đổi lấy [${requestCash}$ + ${theirPropName}]. Đồng ý không?`;
    onSendTradeMessage(tradeMsg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-2xl bg-[#fffef7] text-[#1e293b] border-4 border-[#1e293b] shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#1e293b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-400" />
            <h2 className="text-base md:text-lg font-black tracking-wide">
              Đàm Phán & Giao Dịch Bất Động Sản
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Select Partner */}
          <div>
            <label className="font-extrabold text-stone-700 block mb-1.5">
              Chọn người chơi muốn giao dịch:
            </label>
            <div className="flex flex-wrap gap-2">
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPartnerId(p.id)}
                  className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    selectedPartnerId === p.id
                      ? 'bg-amber-400 text-slate-900 border-amber-600 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span>{p.name} ({p.cash}$)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trade columns */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
            {/* My Offer */}
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-300 space-y-2">
              <h4 className="font-extrabold text-emerald-800 text-center">BẠN ĐƯA RA</h4>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block">Tiền mặt ($):</label>
                <input
                  type="number"
                  min="0"
                  max={player.cash}
                  value={offerCash}
                  onChange={(e) => setOfferCash(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block">Kèm mảnh đất:</label>
                <select
                  value={selectedMyProp ?? ''}
                  onChange={(e) => setSelectedMyProp(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs"
                >
                  <option value="">-- Không kèm đất --</option>
                  {player.properties.map((p) => (
                    <option key={p.spaceId} value={p.spaceId}>
                      {MONOPOLY_SPACES[p.spaceId]?.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Their Offer */}
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-300 space-y-2">
              <h4 className="font-extrabold text-blue-800 text-center">ĐỐI TÁC TRẢ</h4>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block">Tiền mặt ($):</label>
                <input
                  type="number"
                  min="0"
                  max={partner?.cash || 1000}
                  value={requestCash}
                  onChange={(e) => setRequestCash(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-600 block">Kèm mảnh đất:</label>
                <select
                  value={selectedTheirProp ?? ''}
                  onChange={(e) => setSelectedTheirProp(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs"
                >
                  <option value="">-- Không kèm đất --</option>
                  {partner?.properties.map((p) => (
                    <option key={p.spaceId} value={p.spaceId}>
                      {MONOPOLY_SPACES[p.spaceId]?.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f5f2e5] border-t-2 border-[#1e293b] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-stone-300 hover:bg-stone-200 font-bold cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleProposeTrade}
            disabled={!partner}
            className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-md cursor-pointer disabled:opacity-50"
          >
            Gửi Lời Đề Nghị Giao Dịch
          </button>
        </div>
      </div>
    </div>
  );
};
