import React, { useState, useEffect, useRef } from 'react';
import { SpaceData, Player, GameState } from '../types/monopoly';
import { MONOPOLY_SPACES } from '../data/monopolyBoard';
import { RobloxToken } from './RobloxToken';
import { sounds } from '../utils/soundEffects';
import { Sparkles, Dice5, HelpCircle, Layers, ArrowRight } from 'lucide-react';

interface MonopolyBoardProps {
  gameState: GameState;
  currentUserId: string;
  onSpaceClick: (space: SpaceData) => void;
  onRollDice: () => void;
  onEndTurn: () => void;
  onOpenManagement: () => void;
  onOpenTrade: () => void;
  animatingPlayerId: string | null;
  animatingPath: number[];
}

export const MonopolyBoard: React.FC<MonopolyBoardProps> = ({
  gameState,
  currentUserId,
  onSpaceClick,
  onRollDice,
  onEndTurn,
  onOpenManagement,
  onOpenTrade,
  animatingPlayerId,
  animatingPath,
}) => {
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, number>>({});
  const [hoveredSpace, setHoveredSpace] = useState<SpaceData | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (space: SpaceData) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // 0.65s (650ms) debounce to prevent accidental passes triggering popover
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSpace(space);
    }, 650);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredSpace(null);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === currentUserId;
  const canRoll = isMyTurn && gameState.turnPhase === 'ROLL_DICE' && !gameState.dice.isRolling;

  // 3-4s Dice Tumbling display state
  const [displayDice, setDisplayDice] = useState<{ d1: number; d2: number }>({
    d1: gameState.dice.die1 || 1,
    d2: gameState.dice.die2 || 2,
  });

  // Cycle dice faces dynamically during rolling
  useEffect(() => {
    if (gameState.dice.isRolling) {
      sounds.playDiceRoll(3500);
      const interval = setInterval(() => {
        setDisplayDice({
          d1: Math.floor(Math.random() * 6) + 1,
          d2: Math.floor(Math.random() * 6) + 1,
        });
      }, 70);

      return () => clearInterval(interval);
    } else {
      setDisplayDice({
        d1: gameState.dice.die1,
        d2: gameState.dice.die2,
      });
    }
  }, [gameState.dice.isRolling, gameState.dice.die1, gameState.dice.die2]);

  // Handle step-by-step moving animation
  useEffect(() => {
    if (animatingPlayerId && animatingPath.length > 0) {
      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < animatingPath.length) {
          const nextPos = animatingPath[stepIndex];
          setAnimatedPositions((prev) => ({ ...prev, [animatingPlayerId]: nextPos }));
          sounds.playStep();
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 140);
      return () => clearInterval(interval);
    }
  }, [animatingPlayerId, animatingPath]);

  // Sync positions when not animating
  useEffect(() => {
    const map: Record<string, number> = {};
    gameState.players.forEach((p) => {
      if (p.id !== animatingPlayerId) {
        map[p.id] = p.position;
      }
    });
    setAnimatedPositions((prev) => ({ ...prev, ...map }));
  }, [gameState.players, animatingPlayerId]);

  // Map spaceId to 11x11 grid layout [row, col] (1-indexed)
  const getGridPosition = (id: number): { row: number; col: number; side: 'bottom' | 'left' | 'top' | 'right' | 'corner' } => {
    if (id === 0) return { row: 11, col: 11, side: 'corner' };
    if (id > 0 && id < 10) return { row: 11, col: 11 - id, side: 'bottom' };
    if (id === 10) return { row: 11, col: 1, side: 'corner' };
    if (id > 10 && id < 20) return { row: 11 - (id - 10), col: 1, side: 'left' };
    if (id === 20) return { row: 1, col: 1, side: 'corner' };
    if (id > 20 && id < 30) return { row: 1, col: 1 + (id - 20), side: 'top' };
    if (id === 30) return { row: 1, col: 11, side: 'corner' };
    if (id > 30 && id < 40) return { row: 1 + (id - 30), col: 11, side: 'right' };
    return { row: 11, col: 11, side: 'corner' };
  };

  // Find owner of a space
  const getSpaceOwner = (spaceId: number): { player: Player; houses: number; isMortgaged: boolean } | null => {
    for (const p of gameState.players) {
      const prop = p.properties.find((pr) => pr.spaceId === spaceId);
      if (prop) {
        return { player: p, houses: prop.houses, isMortgaged: prop.isMortgaged };
      }
    }
    return null;
  };

  // Small Popover positioning relative to space (points toward center of the board)
  const getPopoverPositionClass = (side: 'bottom' | 'left' | 'top' | 'right' | 'corner', id: number) => {
    if (id === 0) return 'bottom-[104%] right-0';
    if (id === 10) return 'bottom-[104%] left-0';
    if (id === 20) return 'top-[104%] left-0';
    if (id === 30) return 'top-[104%] right-0';
    if (side === 'bottom') return 'bottom-[104%] left-1/2 -translate-x-1/2';
    if (side === 'top') return 'top-[104%] left-1/2 -translate-x-1/2';
    if (side === 'left') return 'left-[104%] top-1/2 -translate-y-1/2';
    if (side === 'right') return 'right-[104%] top-1/2 -translate-y-1/2';
    return 'bottom-[104%] left-1/2 -translate-x-1/2';
  };

  // Render individual space
  const renderSpace = (space: SpaceData) => {
    const { row, col, side } = getGridPosition(space.id);
    const ownerInfo = getSpaceOwner(space.id);
    const isBought = Boolean(ownerInfo);
    const isHovered = hoveredSpace?.id === space.id;

    // Players currently on this space
    const playersHere = gameState.players.filter(
      (p) => !p.isBankrupt && (animatedPositions[p.id] ?? p.position) === space.id
    );

    const isCorner = side === 'corner';

    return (
      <div
        key={space.id}
        onClick={() => onSpaceClick(space)}
        onMouseEnter={() => handleMouseEnter(space)}
        onMouseLeave={handleMouseLeave}
        style={{
          gridRow: row,
          gridColumn: col,
          backgroundColor: isBought ? `${ownerInfo!.player.color}18` : '#fffdf5',
          borderColor: isBought ? ownerInfo!.player.color : undefined,
        }}
        className={`relative flex flex-col justify-between cursor-pointer select-none transition-all ${
          isHovered ? 'z-50 overflow-visible ring-2 ring-red-500 shadow-xl' : 'overflow-hidden hover:brightness-95'
        } ${
          isCorner ? 'p-1' : 'p-0.5'
        } ${
          isBought ? 'border-2' : 'border border-[#2b2d42]/30'
        }`}
        title={`${space.name} ${space.price ? `(${space.price}$)` : ''}${ownerInfo ? ` - Chủ: ${ownerInfo.player.name}` : ' - Chưa mua'}`}
      >
        {/* Owner ribbon with player's color (Requirement 2) */}
        {ownerInfo && (
          <div
            className="w-full py-0.5 px-0.5 text-white text-[7px] font-black uppercase tracking-wider text-center flex items-center justify-center shrink-0 truncate shadow-xs"
            style={{ backgroundColor: ownerInfo.player.color }}
            title={`Đã mua bởi: ${ownerInfo.player.name}`}
          >
            <span className="truncate">{ownerInfo.player.name}</span>
          </div>
        )}

        {/* Color bar for properties */}
        {space.colorGroup !== 'special' && space.colorGroup !== 'station' && space.colorGroup !== 'utility' && (
          <div
            className={`w-full font-bold text-[8.5px] text-white flex items-center justify-center shrink-0 ${
              side === 'top' ? 'order-last h-2.5' : 'h-2.5'
            }`}
            style={{ backgroundColor: space.colorHex }}
          >
            {!isBought && space.price ? `${space.price}$` : ''}
          </div>
        )}

        {/* Space main content */}
        <div className="flex-1 flex flex-col items-center justify-between text-center p-0.5 min-h-0 w-full overflow-hidden">
          {/* Landmark Name (Requirement 3: high contrast, visible, no clipping) */}
          <span 
            className="text-[7.5px] sm:text-[8px] md:text-[9px] font-black text-slate-900 leading-[1.05] text-center w-full px-0.5 break-words line-clamp-2"
            title={space.name}
          >
            {space.name}
          </span>

          {/* Space Icon & Price/Subtext */}
          <div className="flex flex-col items-center justify-center my-auto">
            <span className="text-xs sm:text-sm md:text-base leading-none">
              {space.icon}
            </span>
            {!isBought && space.price && !isCorner && (
              <span className="text-[7px] sm:text-[8px] md:text-[8.5px] font-extrabold text-slate-600 leading-none mt-0.5">
                {space.price}$
              </span>
            )}
          </div>

          {/* Houses / Hotel icons with PLAYER'S COLOR (Requirement 2) */}
          {ownerInfo ? (
            <div className="w-full flex items-center justify-center pb-0.5">
              {ownerInfo.houses > 0 ? (
                <div
                  className="flex items-center justify-center gap-0.5 px-1 py-0.2 rounded text-[7.5px] font-black text-white shadow-xs"
                  style={{ backgroundColor: ownerInfo.player.color }}
                  title={`${ownerInfo.houses === 5 ? 'Khách sạn' : `${ownerInfo.houses} nhà`} của ${ownerInfo.player.name}`}
                >
                  {ownerInfo.houses === 5 ? (
                    <>
                      <span className="text-[9px]">⭐</span>
                      <span>KS</span>
                    </>
                  ) : (
                    <>
                      <span>{ownerInfo.houses}</span>
                      <span className="text-[8px]">🏠</span>
                    </>
                  )}
                </div>
              ) : (
                <span 
                  className="text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-tight px-1 rounded-xs text-white"
                  style={{ backgroundColor: ownerInfo.player.color }}
                >
                  ĐÃ MUA
                </span>
              )}
            </div>
          ) : (
            <div className="h-1" />
          )}
        </div>

        {/* Tokens on this space */}
        {playersHere.length > 0 && (
          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 z-20 pointer-events-none p-0.5 bg-black/15">
            {playersHere.map((p) => {
              const isTurn = gameState.players[gameState.currentPlayerIndex]?.id === p.id;
              const isMe = p.id === currentUserId;
              return (
                <RobloxToken
                  key={p.id}
                  player={p}
                  isCurrentTurn={isTurn}
                  turnTimeLeft={isTurn ? gameState.currentTurnTimeLeft : undefined}
                  turnTimeMax={gameState.turnTimerMax}
                  isMoving={animatingPlayerId === p.id}
                  size="sm"
                  isMe={isMe}
                />
              );
            })}
          </div>
        )}

        {/* Small Popover right near Space/Square (Requirement 1 & 3: 0.65s debounce) */}
        {isHovered && (
          <div
            className={`absolute ${getPopoverPositionClass(side, space.id)} z-50 pointer-events-none w-44 sm:w-48 bg-slate-900 text-white rounded-xl p-2.5 shadow-2xl border-2 border-slate-700 animate-in fade-in zoom-in-95 duration-150`}
            style={{ minWidth: '175px' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-slate-800">
              <span className="text-lg leading-none shrink-0">{space.icon}</span>
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-black text-xs text-amber-300 truncate leading-tight">{space.name}</h4>
                <span
                  className="text-[8.5px] font-bold px-1 py-0.2 rounded text-white inline-block mt-0.5 truncate max-w-full"
                  style={{ backgroundColor: space.colorHex }}
                >
                  {space.subName || space.type.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="text-[10px] space-y-1 text-slate-300 text-left">
              {space.price && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Giá mua:</span>
                  <span className="font-extrabold text-emerald-400">{space.price}$</span>
                </div>
              )}
              {ownerInfo ? (
                <>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-400 shrink-0">Chủ sở hữu:</span>
                    <span
                      className="font-bold px-1.5 py-0.2 rounded text-[9px] text-white truncate max-w-[100px]"
                      style={{ backgroundColor: ownerInfo.player.color }}
                    >
                      {ownerInfo.player.name}
                    </span>
                  </div>
                  {ownerInfo.houses > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Công trình:</span>
                      <span className="font-bold text-amber-300">
                        {ownerInfo.houses === 5 ? '⭐ Khách sạn' : `${ownerInfo.houses} Nhà 🏠`}
                      </span>
                    </div>
                  )}
                  {ownerInfo.isMortgaged && (
                    <div className="text-rose-400 font-bold text-[9px]">
                      ⚠️ Đang thế chấp
                    </div>
                  )}
                </>
              ) : space.price ? (
                <div className="text-emerald-400 font-bold text-[9px] pt-0.5">
                  ✨ Chưa ai sở hữu
                </div>
              ) : (
                <div className="text-slate-400 text-[9px] italic">
                  Ô sự kiện / đặc biệt
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render 3D Tumbling Dice Face SVG
  const renderDie = (value: number, isRolling: boolean, dieIndex: 1 | 2) => {
    const dots: Record<number, [number, number][]> = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [25, 75], [75, 25], [75, 75]],
      5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
      6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
    };

    return (
      <div
        className={`w-14 h-14 md:w-18 md:h-18 rounded-2xl bg-white border-3 border-slate-950 shadow-[0_6px_0_#0f172a] flex items-center justify-center p-1.5 relative transition-all ${
          isRolling
            ? dieIndex === 1
              ? 'animate-dice-tumble-1 shadow-[0_12px_24px_rgba(0,0,0,0.7)]'
              : 'animate-dice-tumble-2 shadow-[0_12px_24px_rgba(0,0,0,0.7)]'
            : 'transform hover:rotate-3'
        }`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-xs">
          {(dots[value] || dots[1]).map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="11"
              fill={value === 1 ? '#dc2626' : '#0f172a'}
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-[680px] aspect-square rounded-2xl border-4 md:border-6 border-[#1e293b] shadow-2xl overflow-hidden bg-[#2d6a4f] p-1 md:p-1.5 flex flex-col justify-center">
      {/* 11x11 Grid Board matching banco.PNG */}
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: 'repeat(11, 1fr)',
          gridTemplateRows: 'repeat(11, 1fr)',
        }}
      >
        {/* Render all 40 Spaces */}
        {MONOPOLY_SPACES.map((space) => renderSpace(space))}

        {/* Center Board Area (Rows 2 to 10, Cols 2 to 10) */}
        <div
          style={{
            gridRow: '2 / 11',
            gridColumn: '2 / 11',
          }}
          className="relative rounded-lg bg-[#1f563b] border-2 border-[#164e31] flex flex-col items-center justify-between p-3 md:p-6 shadow-inner overflow-hidden select-none"
        >
          {/* Chance Deck (Red) - Upper Left Center */}
          <div className="w-full flex justify-between items-start z-10 gap-2">
            <div
              onClick={() => onSpaceClick(MONOPOLY_SPACES[7])}
              className="w-24 md:w-32 h-14 md:h-18 rounded-lg bg-red-600 hover:bg-red-500 border-2 border-red-900 shadow-lg flex flex-col items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <span className="font-black text-sm md:text-base tracking-wider text-amber-200">
                Cơ hội
              </span>
              <span className="text-xs text-red-100 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Rút thẻ</span>
              </span>
            </div>

            {/* Quick Room Code & Game Rule Status (Requirement 5) */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-200 flex items-center gap-1.5 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Phòng: #{gameState.roomId}</span>
              </div>

              {gameState.status === 'playing' && gameState.endRule && (
                <div className="bg-[#0f2d1e] px-2.5 py-1 rounded-full text-[11px] font-black text-amber-300 flex items-center gap-1 border border-amber-500/40 shadow-xs">
                  {gameState.endRule.type === 'max_rolls' && (
                    <span>🎲 Lượt xúc xắc: {gameState.totalRollsCount || 0}/{gameState.endRule.value}</span>
                  )}
                  {gameState.endRule.type === 'time_limit' && (
                    <span>⏰ Thời gian: {Math.floor((gameState.gameTimeElapsed || 0) / 60)}:{String((gameState.gameTimeElapsed || 0) % 60).padStart(2, '0')} / {gameState.endRule.value}m</span>
                  )}
                  {gameState.endRule.type === 'target_cash' && (
                    <span>🎯 Mục tiêu: {gameState.endRule.value}$</span>
                  )}
                  {gameState.endRule.type === 'bankruptcy' && (
                    <span>⚔️ Đấu loại sinh tồn</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center Dice Area */}
          <div className="flex flex-col items-center justify-center gap-2.5 z-10 my-auto">
            <div className="flex items-center gap-4">
              {renderDie(displayDice.d1, gameState.dice.isRolling, 1)}
              {renderDie(displayDice.d2, gameState.dice.isRolling, 2)}
            </div>

            {/* Dice Roll / Action Instruction */}
            <div className="text-center mt-1">
              {gameState.dice.isRolling ? (
                <div className="flex flex-col items-center gap-1.5 animate-pulse">
                  <span className="px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs md:text-sm shadow-xl border-2 border-slate-900 tracking-wide flex items-center gap-1.5">
                    <Dice5 className="w-4 h-4 animate-spin" />
                    <span>Đang lắc xúc xắc...</span>
                  </span>
                  <div className="w-32 h-2 bg-slate-900/60 rounded-full overflow-hidden p-0.5 border border-amber-400/40">
                    <div className="h-full bg-red-600 rounded-full animate-pulse" />
                  </div>
                </div>
              ) : canRoll ? (
                <button
                  onClick={onRollDice}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 font-extrabold text-sm md:text-base shadow-[0_4px_0_#b45309] transition-all flex items-center gap-2 cursor-pointer animate-pulse"
                >
                  <Dice5 className="w-5 h-5" />
                  <span>Gieo Xúc Xắc ({gameState.currentTurnTimeLeft}s)</span>
                </button>
              ) : (
                <p className="text-xs md:text-sm font-bold text-emerald-100 drop-shadow-xs">
                  {gameState.status === 'playing' ? (
                    <>
                      Lượt của:{' '}
                      <span
                        className="font-extrabold px-2 py-0.5 rounded-full text-white"
                        style={{
                          backgroundColor:
                            gameState.players[gameState.currentPlayerIndex]?.color || '#3b82f6',
                        }}
                      >
                        {gameState.players[gameState.currentPlayerIndex]?.name || '...'}
                      </span>
                      {gameState.turnPhase === 'ROLL_DICE' && ` (${gameState.currentTurnTimeLeft}s)`}
                    </>
                  ) : (
                    'Đang chờ bắt đầu...'
                  )}
                </p>
              )}

              {/* Double roll notification */}
              {gameState.dice.isDouble && (
                <p className="text-xs font-black text-amber-300 animate-bounce mt-1">
                  ⭐ ĐỔ KÉP! Được gieo tiếp lượt nữa! ⭐
                </p>
              )}
            </div>
          </div>

          {/* Chest Deck (Blue) - Lower Right Center */}
          <div className="w-full flex justify-end z-10">
            <div
              onClick={() => onSpaceClick(MONOPOLY_SPACES[2])}
              className="w-24 md:w-32 h-14 md:h-18 rounded-lg bg-blue-600 hover:bg-blue-500 border-2 border-blue-900 shadow-lg flex flex-col items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <span className="font-black text-sm md:text-base tracking-wider text-sky-200">
                Khí vận
              </span>
              <span className="text-xs text-blue-100 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Kho báu</span>
              </span>
            </div>
          </div>

          {/* Bottom Control Buttons matching banco.PNG */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-2 z-10 border-t border-emerald-700/50">
            <button
              onClick={onOpenManagement}
              className="px-4 md:px-5 py-2 rounded-xl bg-[#faf8ee] hover:bg-white text-[#1e293b] font-black text-xs md:text-sm border-2 border-[#1e293b] shadow-[0_3px_0_#1e293b] active:translate-y-0.5 active:shadow-[0_1px_0_#1e293b] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Quản lý</span>
            </button>

            <button
              onClick={onOpenTrade}
              disabled={!isMyTurn}
              className={`px-4 md:px-5 py-2 rounded-xl font-black text-xs md:text-sm border-2 border-[#1e293b] shadow-[0_3px_0_#1e293b] transition-all flex items-center gap-1.5 ${
                isMyTurn
                  ? 'bg-[#faf8ee] hover:bg-white text-[#1e293b] cursor-pointer active:translate-y-0.5'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
              }`}
            >
              <span>Giao dịch</span>
            </button>

            {/* End Turn Button (Requirement 4) */}
            {isMyTurn && (
              <button
                onClick={onEndTurn}
                className="px-4 md:px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs md:text-sm border-2 border-[#1e293b] shadow-[0_3px_0_#1e293b] active:translate-y-0.5 active:shadow-[0_1px_0_#1e293b] transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                title="Chủ động kết thúc lượt ngay lập tức"
              >
                <span>Kết thúc lượt ⏭️</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
