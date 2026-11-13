import React from 'react';
import { Player, GameState } from '../types/monopoly';
import { MONOPOLY_SPACES, COLOR_GROUPS } from '../data/monopolyBoard';
import { X, Home, Building2, ShieldAlert, DollarSign, Wallet, Award } from 'lucide-react';

interface ManagementModalProps {
  player: Player;
  gameState: GameState;
  onClose: () => void;
  onUpgrade: (spaceId: number) => void;
  onMortgage: (spaceId: number) => void;
  onUnmortgage: (spaceId: number) => void;
  onBankrupt: () => void;
}

export const ManagementModal: React.FC<ManagementModalProps> = ({
  player,
  gameState,
  onClose,
  onUpgrade,
  onMortgage,
  onUnmortgage,
  onBankrupt,
}) => {
  // Calculate total net worth
  const totalPropertyValue = player.properties.reduce((sum, prop) => {
    const space = MONOPOLY_SPACES[prop.spaceId];
    if (!space) return sum;
    const baseVal = prop.isMortgaged ? 0 : (space.price || 0);
    const houseVal = prop.houses * (space.houseCost || 0);
    return sum + baseVal + houseVal;
  }, 0);

  const netWorth = player.cash + totalPropertyValue;

  // Check if player has complete monopoly in a group
  const hasMonopoly = (colorGroup: string): boolean => {
    const group = COLOR_GROUPS[colorGroup] || [];
    return group.length > 0 && group.every((sId) =>
      player.properties.some((p) => p.spaceId === sId && !p.isMortgaged)
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl max-h-[90vh] rounded-2xl bg-[#fffef7] text-[#1e293b] border-4 border-[#1e293b] shadow-2xl overflow-hidden flex flex-col font-sans relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#1e293b] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg border-2 border-white/80 flex items-center justify-center text-lg shadow-xs"
              style={{ backgroundColor: player.color }}
            >
              {player.avatar.hat}
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide">
                Quản Lý Tài Sản: {player.name}
              </h2>
              <p className="text-xs text-slate-300">
                Xem danh mục đất đai, nhà ở và tình hình tài chính
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wealth Statistics Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-[#faf8ee] border-b-2 border-stone-200 text-center text-xs">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-700 font-semibold block">Tiền Mặt</span>
            <span className="text-base font-extrabold text-emerald-900">{player.cash}$</span>
          </div>
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-blue-700 font-semibold block">Giá Trị Đất/Nhà</span>
            <span className="text-base font-extrabold text-blue-900">{totalPropertyValue}$</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-700 font-semibold block">Tổng Tài Sản Ròng</span>
            <span className="text-base font-extrabold text-amber-900">{netWorth}$</span>
          </div>
        </div>

        {/* Jail status / cards */}
        {player.getOutOfJailCards > 0 && (
          <div className="px-4 py-2 bg-purple-50 text-purple-800 text-xs font-bold border-b border-purple-200 flex items-center justify-between">
            <span>🎫 Bạn sở hữu {player.getOutOfJailCards} Thẻ Miễn Phạt Ra Tù</span>
          </div>
        )}

        {/* Properties List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-stone-700 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Danh mục bất động sản ({player.properties.length} khu đất)</span>
          </h3>

          {player.properties.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-sm">
              <p>Bạn chưa sở hữu mảnh đất nào!</p>
              <p className="text-xs text-stone-400 mt-1">
                Hãy di chuyển qua các ô trên bàn cờ để mua bất động sản.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {player.properties.map((prop) => {
                const space = MONOPOLY_SPACES[prop.spaceId];
                if (!space) return null;
                const fullGroup = hasMonopoly(space.colorGroup);
                const canBuild =
                  fullGroup &&
                  space.type === 'property' &&
                  prop.houses < 5 &&
                  !prop.isMortgaged &&
                  player.cash >= (space.houseCost || 0);

                return (
                  <div
                    key={prop.spaceId}
                    className="p-2.5 rounded-xl border border-stone-300 bg-white shadow-xs flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-10 rounded-sm shrink-0 shadow-inner"
                        style={{ backgroundColor: space.colorHex }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-base">{space.icon}</span>
                          <span className="font-extrabold text-sm truncate">{space.name}</span>
                        </div>
                        <div className="text-xs text-stone-500">
                          {prop.houses === 5 ? (
                            <span className="font-bold text-amber-600">⭐ Khách sạn</span>
                          ) : prop.houses > 0 ? (
                            <span className="font-bold text-emerald-600">{prop.houses} căn nhà 🏠</span>
                          ) : (
                            <span>Đất trống</span>
                          )}
                          {prop.isMortgaged && (
                            <span className="ml-1 text-red-600 font-bold">(Đang thế chấp)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-stone-100 text-xs">
                      {space.type === 'property' && (
                        <button
                          disabled={!canBuild}
                          onClick={() => onUpgrade(space.id)}
                          className={`flex-1 py-1 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
                            canBuild
                              ? 'bg-amber-500 hover:bg-amber-400 text-white cursor-pointer shadow-xs'
                              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          }`}
                          title={
                            fullGroup
                              ? `Nâng cấp (${space.houseCost}$)`
                              : 'Cần sở hữu đủ bộ màu để xây nhà'
                          }
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>Xây nhà ({space.houseCost}$)</span>
                        </button>
                      )}

                      {prop.isMortgaged ? (
                        <button
                          disabled={player.cash < Math.round((space.mortgageValue || 50) * 1.1)}
                          onClick={() => onUnmortgage(space.id)}
                          className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center cursor-pointer shadow-xs"
                        >
                          Chuộc ({Math.round((space.mortgageValue || 50) * 1.1)}$)
                        </button>
                      ) : (
                        <button
                          disabled={prop.houses > 0}
                          onClick={() => onMortgage(space.id)}
                          className={`flex-1 py-1 px-2 rounded-lg font-bold text-center transition-all ${
                            prop.houses === 0
                              ? 'bg-stone-200 hover:bg-stone-300 text-stone-800 cursor-pointer'
                              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          }`}
                          title={prop.houses > 0 ? 'Phải bán hết nhà trước khi thế chấp' : ''}
                        >
                          Cầm cố (+{space.mortgageValue}$)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f5f2e5] border-t-2 border-[#1e293b] flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn đầu hàng và tuyên bố phá sản không?')) {
                onBankrupt();
                onClose();
              }
            }}
            className="py-2 px-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Tuyên bố phá sản</span>
          </button>

          <button
            onClick={onClose}
            className="py-2 px-6 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
          >
            Đóng bảng quản lý
          </button>
        </div>
      </div>
    </div>
  );
};
