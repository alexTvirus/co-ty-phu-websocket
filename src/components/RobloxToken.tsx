import React from 'react';
import { Player } from '../types/monopoly';

interface RobloxTokenProps {
  player: Player;
  isCurrentTurn?: boolean;
  isMoving?: boolean;
  size?: 'sm' | 'md' | 'lg';
  turnTimeLeft?: number;
  turnTimeMax?: number;
  isMe?: boolean;
}

export const RobloxToken: React.FC<RobloxTokenProps> = ({
  player,
  isCurrentTurn,
  isMoving,
  size = 'md',
  turnTimeLeft,
  turnTimeMax = 15,
  isMe = false,
}) => {
  const avatar = player.avatar;
  const isDead = player.isBankrupt || player.isDisconnected || player.isQuit;

  // Requirement 3: Current player token is standard/prominent, other players' tokens are smaller!
  const sizeClasses = {
    sm: isMe ? 'w-7 h-8 text-[11px]' : 'w-5 h-6 text-[9px]',
    md: isMe ? 'w-9 h-10 text-xs scale-105' : 'w-7 h-8 text-[10px] opacity-85',
    lg: isMe ? 'w-12 h-14 text-sm scale-105' : 'w-9 h-10 text-xs opacity-90',
  }[size];

  // Requirement 1: If disconnected or quit, token turns black/grayscale
  const tokenColor = isDead 
    ? '#18181b' 
    : (avatar?.color || player.color || '#facc15');

  // Calculate circular progress for turn countdown
  const progressPercent = turnTimeLeft !== undefined && turnTimeMax > 0 
    ? Math.max(0, Math.min(100, (turnTimeLeft / turnTimeMax) * 100))
    : 100;
  
  // Circumference for r=16 circle: 2 * PI * 16 = ~100.5
  const strokeDashoffset = 100.5 - (progressPercent / 100) * 100.5;

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none transition-all duration-300 ${
        isDead
          ? 'grayscale opacity-50 z-10'
          : isMe
          ? 'animate-token-blink z-30'
          : 'z-20'
      } ${isMoving ? 'animate-bounce scale-125 z-40' : ''}`}
      style={{ color: tokenColor }}
      title={`${player.name} (${player.cash}$)${isDead ? ' - Đã thoát/Mất kết nối' : isMe ? ' (BẠN)' : ''}`}
    >
      {/* Blinking Beacon Halo: Only prominent for current user token or active turn, turned OFF for disconnected */}
      {!isDead && (isMe || isCurrentTurn) && (
        <div
          className={`absolute rounded-full pointer-events-none -z-10 ${
            isMe ? 'w-9 h-9 md:w-11 md:h-11 animate-token-beacon' : 'w-7 h-7 opacity-40'
          }`}
          style={{
            backgroundColor: tokenColor,
            boxShadow: isMe 
              ? `0 0 14px ${tokenColor}, 0 0 24px ${tokenColor}99`
              : `0 0 6px ${tokenColor}`,
          }}
        />
      )}

      {/* Turn Countdown Circular Progress Ring (Requirement 1) */}
      {isCurrentTurn && (
        <div className="absolute -inset-2.5 flex items-center justify-center pointer-events-none z-10">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            {/* Background ring */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeOpacity="0.7"
            />
            {/* Animated countdown progress ring */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#dc2626"
              strokeWidth="3.5"
              strokeDasharray="100.5"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
        </div>
      )}

      {/* Floating Indicator Marker & Countdown Seconds Badge */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-30">
        {isCurrentTurn ? (
          <div className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-slate-950/90 border border-amber-400 text-[9px] font-black text-amber-300 shadow-md">
            <span>🔻</span>
            {turnTimeLeft !== undefined && <span>{turnTimeLeft}s</span>}
          </div>
        ) : isDead ? (
          <span className="text-[10px] bg-black text-rose-500 font-black px-1 rounded-full border border-stone-700">
            ✖
          </span>
        ) : isMe ? (
          <span className="px-1 py-0.2 rounded-full bg-emerald-500 text-white font-black text-[8px] shadow-sm tracking-tighter">
            BẠN
          </span>
        ) : (
          <span
            className="w-1.5 h-1.5 rounded-full border border-white/60 shadow-xs opacity-50"
            style={{ backgroundColor: tokenColor }}
          />
        )}
      </div>

      {/* Roblox Head and Hat with high-contrast outer ring and inner border */}
      <div
        className={`${sizeClasses} relative rounded-lg border-2 ${
          isDead ? 'border-black bg-stone-900 ring-1 ring-stone-800' : 'border-slate-950 ring-2 ring-white/90 shadow-xl'
        } flex flex-col items-center justify-center font-bold text-slate-900`}
        style={{
          backgroundColor: tokenColor,
          boxShadow: isDead
            ? 'none'
            : isCurrentTurn
            ? `0 0 14px ${tokenColor}, 0 4px 10px rgba(0, 0, 0, 0.6)`
            : isMe
            ? `0 0 10px ${tokenColor}`
            : '0 2px 6px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Hat / Accessory */}
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs leading-none drop-shadow-md">
          {isDead ? '💀' : avatar?.hat}
        </span>

        {/* Face */}
        <span className="text-xs leading-none mt-0.5 filter drop-shadow-xs">
          {isDead ? '❌' : avatar?.face || '😀'}
        </span>

        {/* Mini Torso Block */}
        <div
          className="w-full h-1.5 absolute -bottom-1 rounded-xs border-x-2 border-b-2 border-slate-950"
          style={{ backgroundColor: isDead ? '#09090b' : (avatar?.accentColor || '#1e293b') }}
        />
      </div>

      {/* Mini Name Pill under token on large views */}
      {size === 'lg' && (
        <span
          className="mt-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full text-white max-w-[65px] truncate border-2 border-slate-900 shadow-md ring-1 ring-white/70"
          style={{ backgroundColor: player.color }}
        >
          {player.name}
        </span>
      )}
    </div>
  );
};
