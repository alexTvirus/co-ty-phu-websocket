import React from 'react';
import { SpaceData, Player } from '../types/monopoly';
import { X, Home, Building2, ShieldCheck, Zap } from 'lucide-react';

interface SpaceCardModalProps {
  space: SpaceData;
  owner?: Player;
  isCurrentPlayerTurn?: boolean;
  canBuy?: boolean;
  canUpgrade?: boolean;
  actionTimeLeft?: number;
  actionTimerMax?: number;
  onClose: () => void;
  onBuy?: () => void;
  onPassProperty?: () => void;
  onUpgrade?: () => void;
  onMortgage?: () => void;
  onUnmortgage?: () => void;
}

export const SpaceCardModal: React.FC<SpaceCardModalProps> = ({
  space,
  owner,
  isCurrentPlayerTurn,
  canBuy,
  canUpgrade,
  actionTimeLeft,
  actionTimerMax = 10,
  onClose,
  onBuy,
  onPassProperty,
  onUpgrade,
  onMortgage,
  onUnmortgage,
}) => {
  const propState = owner?.properties.find((p) => p.spaceId === space.id);
  const houseCount = propState?.houses || 0;
  const isMortgaged = propState?.isMortgaged || false;

  // Auto-close inspection modal after 10s if user does not close manually (Requirement 4)
  const [inspectTimeLeft, setInspectTimeLeft] = React.useState(10);
  React.useEffect(() => {
    if (actionTimeLeft !== undefined) return;
    const interval = setInterval(() => {
      setInspectTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [actionTimeLeft, onClose]);

  const isServerAction = actionTimeLeft !== undefined;
  const currentSeconds = isServerAction ? actionTimeLeft : inspectTimeLeft;
  const timerMax = isServerAction ? actionTimerMax : 10;
  const timerPercent = Math.max(0, (currentSeconds / timerMax) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
      <div 
        className="w-full max-w-xs md:max-w-sm rounded-2xl bg-[#fffef7] text-[#1e293b] border-4 border-[#1e293b] shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col font-sans relative pointer-events-auto origin-center animate-modal-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon top-right */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card Header matching card.PNG */}
        <div
          className="px-4 py-3 flex items-center justify-center gap-3 border-b-2 border-[#1e293b] shadow-inner"
          style={{ backgroundColor: space.colorHex }}
        >
          <div className="w-10 h-10 rounded-lg bg-white/95 border-2 border-[#1e293b] flex items-center justify-center text-xl shadow-xs shrink-0">
            {space.icon}
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-wide drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-center">
            {space.name}
          </h2>
        </div>

        {/* Subtitle: Owner status & Price */}
        <div className="px-4 py-2.5 text-center bg-[#faf8ee]">
          {owner ? (
            <div className="text-sm font-semibold flex items-center justify-center gap-1.5">
              <span>Chủ sở hữu:</span>
              <span
                className="font-bold px-2 py-0.5 rounded-full text-white text-xs shadow-xs"
                style={{ backgroundColor: owner.color }}
              >
                {owner.name}
              </span>
              {houseCount > 0 && (
                <span className="text-xs text-amber-700 font-bold">
                  ({houseCount === 5 ? '⭐ Khách sạn' : `${houseCount} 🏠`})
                </span>
              )}
              {isMortgaged && (
                <span className="text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                  Đang thế chấp
                </span>
              )}
            </div>
          ) : space.price ? (
            <div className="text-sm font-semibold text-slate-700">
              Chưa có chủ - giá <span className="font-extrabold text-slate-900 text-base">{space.price}$</span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-600">{space.subName || 'Ô đặc biệt'}</div>
          )}
        </div>

        {/* Dashed line */}
        <div className="border-t border-dashed border-stone-300 mx-4" />

        {/* Rent & Price breakdown table */}
        <div className="p-4 space-y-1.5 text-sm flex-1">
          {space.type === 'property' && space.rent && (
            <>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 0 && !isMortgaged && owner ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="text-stone-600">Đất trống</span>
                <span className="font-bold text-stone-900">{space.rent[0]}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-2 rounded text-stone-600">
                <span>Đủ nhóm (x2)</span>
                <span className="font-bold text-stone-900">{space.rent[1]}</span>
              </div>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 1 ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="text-stone-600">1 nhà</span>
                <span className="font-bold text-stone-900">{space.rent[2]}</span>
              </div>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 2 ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="text-stone-600">2 nhà</span>
                <span className="font-bold text-stone-900">{space.rent[3]}</span>
              </div>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 3 ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="text-stone-600">3 nhà</span>
                <span className="font-bold text-stone-900">{space.rent[4]}</span>
              </div>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 4 ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="text-stone-600">4 nhà</span>
                <span className="font-bold text-stone-900">{space.rent[5]}</span>
              </div>
              <div
                className={`flex justify-between items-center py-0.5 px-2 rounded ${
                  houseCount === 5 ? 'bg-amber-200 font-extrabold text-amber-900' : ''
                }`}
              >
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>Khách sạn</span>
                  <span className="text-xs">⭐</span>
                </span>
                <span className="font-extrabold text-stone-900">{space.rent[6]}</span>
              </div>
            </>
          )}

          {space.type === 'railroad' && (
            <div className="space-y-1 py-1 text-stone-700">
              <div className="flex justify-between">
                <span>1 Bến/Sân bay:</span>
                <span className="font-bold">25$</span>
              </div>
              <div className="flex justify-between">
                <span>2 Bến/Sân bay:</span>
                <span className="font-bold">50$</span>
              </div>
              <div className="flex justify-between">
                <span>3 Bến/Sân bay:</span>
                <span className="font-bold">100$</span>
              </div>
              <div className="flex justify-between">
                <span>4 Bến/Sân bay:</span>
                <span className="font-bold">200$</span>
              </div>
            </div>
          )}

          {space.type === 'utility' && (
            <div className="space-y-2 py-1 text-stone-700 text-xs">
              <p>• Nếu sở hữu 1 tiện ích: Tiền thuê bằng <strong>4 lần</strong> điểm xúc xắc vừa gieo.</p>
              <p>• Nếu sở hữu cả 2 tiện ích: Tiền thuê bằng <strong>10 lần</strong> điểm xúc xắc vừa gieo.</p>
            </div>
          )}

          {space.type === 'tax' && (
            <div className="py-2 text-center text-red-600 font-bold">
              Phạt thuế nhà nước: {space.taxAmount}$
            </div>
          )}
        </div>

        {/* Dashed line */}
        <div className="border-t border-dashed border-stone-300 mx-4" />

        {/* Upgrade & Mortgage info */}
        {space.houseCost || space.mortgageValue ? (
          <div className="px-4 py-2 text-center text-xs text-stone-600 font-medium">
            {space.houseCost ? `Nâng cấp: ${space.houseCost}$` : ''}
            {space.houseCost && space.mortgageValue ? ' - ' : ''}
            {space.mortgageValue ? `Cầm cố: ${space.mortgageValue}$` : ''}
          </div>
        ) : null}

        {/* Action / Auto-close countdown timer bar (Requirement 4) */}
        <div className="px-4 pt-1 pb-2">
          <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">
            <span>{isServerAction ? 'Thời gian quyết định' : 'Tự động đóng sau'}</span>
            <span className="font-mono">{currentSeconds}s</span>
          </div>
          <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </div>

        {/* Buttons section: Mua, Nâng cấp, Đóng */}
        <div className="p-3 bg-[#f5f2e5] border-t-2 border-[#1e293b] flex flex-col gap-2">
          {canBuy && onBuy && (
            <button
              onClick={onBuy}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Mua đất ngay ({space.price}$)</span>
            </button>
          )}

          {canBuy && onPassProperty && (
            <button
              onClick={onPassProperty}
              className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-600"
            >
              <span>Không mua (Bắt đầu đấu giá) 🏷️</span>
            </button>
          )}

          {canUpgrade && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-black text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Xây nhà ({space.houseCost}$)</span>
            </button>
          )}

          {/* Exact button as card.PNG */}
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1e293b] hover:bg-[#334155] active:scale-98 text-white font-black text-base tracking-wide shadow-md transition-all cursor-pointer text-center"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
