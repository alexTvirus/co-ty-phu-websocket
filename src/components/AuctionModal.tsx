import React, { useState } from 'react';
import { GameState, SpaceData, Player } from '../types/monopoly';
import { MONOPOLY_SPACES } from '../data/monopolyBoard';
import { Gavel, DollarSign, Clock, UserX, Award, ShieldCheck, X } from 'lucide-react';

interface AuctionModalProps {
  gameState: GameState;
  currentUserId: string;
  onBid: (amount: number) => void;
  onPassBid: () => void;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  gameState,
  currentUserId,
  onBid,
  onPassBid,
}) => {
  const auction = gameState.auction;
  if (!auction) return null;

  const space = MONOPOLY_SPACES[auction.spaceId];
  if (!space) return null;

  const myPlayer = gameState.players.find((p) => p.id === currentUserId);
  const currentBidder = gameState.players.find((p) => p.id === auction.currentBidderId);
  const isMyBidTurn = auction.currentBidderId === currentUserId;

  const [customBid, setCustomBid] = useState<number>(auction.currentBid + 10);

  const minBid = auction.currentBid + 10;
  const timerPercent = Math.max(0, (auction.timeLeft / auction.timeMax) * 100);

  const handleQuickBid = (increment: number) => {
    const amount = auction.currentBid + increment;
    if (myPlayer && myPlayer.cash >= amount) {
      onBid(amount);
    }
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customBid > auction.currentBid && myPlayer && myPlayer.cash >= customBid) {
      onBid(customBid);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
      <div 
        className="w-full max-w-md rounded-3xl bg-[#fffef7] text-[#1e293b] border-4 border-[#1e293b] shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col font-sans relative pointer-events-auto origin-center animate-modal-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
              <Gavel className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide uppercase">
                Phiên Đấu Giá Bất Động Sản
              </h2>
              <span className="text-[11px] text-amber-100 font-medium">
                Cơ hội mua đất với giá khởi điểm hấp dẫn!
              </span>
            </div>
          </div>
          <button
            onClick={onPassBid}
            className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
            title="Đóng / Bỏ qua đấu giá"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Property Preview Banner */}
        <div className="p-4 bg-[#faf8ee] border-b-2 border-stone-200 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl border-2 border-[#1e293b] flex items-center justify-center text-2xl shadow-xs shrink-0"
            style={{ backgroundColor: space.colorHex }}
          >
            <span>{space.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-slate-900 truncate">
              {space.name}
            </h3>
            <div className="text-xs text-stone-600 flex items-center gap-2">
              <span>Giá gốc: <strong className="text-slate-800">{space.price}$</strong></span>
              <span>•</span>
              <span>Tiền thuê đất: <strong>{space.rent ? space.rent[0] : 0}$</strong></span>
            </div>
          </div>
        </div>

        {/* Highest Bid Banner */}
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-center">
          <span className="text-xs font-bold text-amber-800 uppercase block">
            Mức Giá Trả Cao Nhất Hiện Tại
          </span>
          <div className="text-2xl font-black text-amber-900 font-mono mt-0.5">
            {auction.currentBid > 0 ? `${auction.currentBid}$` : 'Chưa có ai đặt giá (Khởi điểm 10$)'}
          </div>
          {auction.highestBidderName && (
            <span className="text-xs font-bold text-emerald-700 mt-0.5 inline-flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>Dẫn đầu: {auction.highestBidderName}</span>
            </span>
          )}
        </div>

        {/* Current Bidder Countdown Bar */}
        <div className="px-5 py-3 bg-white border-b border-stone-200">
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>
                Đang đến lượt chào giá của:{' '}
                <strong
                  className="px-2 py-0.5 rounded-full text-white font-extrabold text-[11px]"
                  style={{ backgroundColor: currentBidder?.color || '#3b82f6' }}
                >
                  {currentBidder?.name} {isMyBidTurn ? '(BẠN)' : ''}
                </strong>
              </span>
            </div>
            <span className="font-mono text-amber-700 font-bold">{auction.timeLeft}s</span>
          </div>

          <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </div>

        {/* Bid Actions */}
        <div className="p-4 space-y-3">
          {isMyBidTurn ? (
            <>
              <div className="text-xs font-bold text-stone-700">
                Hãy đưa ra mức giá cao hơn ({minBid}$ trở lên):
              </div>

              {/* Quick bid increments */}
              <div className="grid grid-cols-3 gap-2">
                {[10, 25, 50].map((inc) => {
                  const targetBid = auction.currentBid + inc;
                  const canAfford = myPlayer && myPlayer.cash >= targetBid;
                  return (
                    <button
                      key={inc}
                      disabled={!canAfford}
                      onClick={() => handleQuickBid(inc)}
                      className={`py-2 px-2 rounded-xl font-black text-xs transition-all shadow-xs flex flex-col items-center justify-center cursor-pointer ${
                        canAfford
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                          : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      <span>+{inc}$</span>
                      <span className="text-[10px] font-medium opacity-90">({targetBid}$)</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom bid input */}
              <form onSubmit={handleCustomBidSubmit} className="flex gap-2">
                <input
                  type="number"
                  min={minBid}
                  max={myPlayer?.cash || 1000}
                  value={customBid}
                  onChange={(e) => setCustomBid(parseInt(e.target.value) || minBid)}
                  className="flex-1 px-3 py-1.5 border-2 border-stone-300 rounded-xl font-bold text-sm bg-white"
                />
                <button
                  type="submit"
                  disabled={!myPlayer || myPlayer.cash < customBid || customBid <= auction.currentBid}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xs shadow-xs cursor-pointer disabled:opacity-40"
                >
                  Đặt Giá
                </button>
              </form>

              {/* Pass button */}
              <button
                onClick={onPassBid}
                className="w-full py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserX className="w-4 h-4" />
                <span>Bỏ qua lượt đấu giá này (Pass)</span>
              </button>
            </>
          ) : (
            <div className="py-6 text-center text-stone-500 text-xs italic bg-stone-50 rounded-2xl border border-stone-200">
              <p>Đang chờ {currentBidder?.name || 'người chơi'} đưa ra mức giá...</p>
              <p className="text-[11px] text-stone-400 mt-1">
                Các nút chào giá sẽ tự động mở khi tới lượt của bạn!
              </p>
            </div>
          )}
        </div>

        {/* Active Bidders List */}
        <div className="px-4 py-2.5 bg-[#f5f2e5] border-t-2 border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
          <span>Người tham gia:</span>
          <div className="flex gap-1.5">
            {gameState.players.filter(p => !p.isBankrupt).map((p) => {
              const hasPassed = !auction.activeBidderIds.includes(p.id);
              const isLead = auction.highestBidderId === p.id;
              return (
                <span
                  key={p.id}
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    hasPassed
                      ? 'bg-stone-200 text-stone-400 line-through'
                      : isLead
                      ? 'bg-amber-400 text-slate-900 ring-1 ring-amber-600'
                      : 'bg-white text-stone-700 border border-stone-300'
                  }`}
                  title={hasPassed ? 'Đã bỏ qua' : isLead ? 'Đang trả giá cao nhất' : 'Còn tham gia'}
                >
                  {p.name.split(' ')[0]}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
