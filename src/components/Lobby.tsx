import React, { useState } from 'react';
import { Player, TokenAvatar, GameEndRule, EndRuleType } from '../types/monopoly';
import { ROBLOX_AVATARS, getRandomName } from '../data/monopolyBoard';
import { RobloxToken } from './RobloxToken';
import { 
  Users, 
  Bot, 
  Play, 
  Shuffle, 
  Copy, 
  Check, 
  Sparkles, 
  Crown, 
  Clock, 
  DollarSign, 
  UserPlus, 
  UserMinus, 
  CheckCircle2, 
  AlertCircle,
  LogIn,
  LogOut,
  Sliders,
  ShieldAlert,
  Trophy,
  Target,
  Swords
} from 'lucide-react';

interface LobbyProps {
  roomId: string;
  players: Player[];
  currentUserId: string;
  hostId: string;
  maxPlayers: number;
  mainTurnTimerMax: number;
  startingCash: number;
  onCreateRoom: (config: {
    roomId?: string;
    name: string;
    avatarId: string;
    maxPlayers: number;
    mainTurnTimer: number;
    startingCash: number;
    endRule?: GameEndRule;
  }) => void;
  onJoinRoom: (roomId: string, name: string, avatarId: string) => void;
  onToggleReady: () => void;
  onKickPlayer: (playerId: string) => void;
  onQuitGame: () => void;
  onAddBot: () => void;
  onStartGame: () => void;
  onRemovePlayer: (playerId: string) => void;
  isConnected: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({
  roomId,
  players,
  currentUserId,
  hostId,
  maxPlayers = 4,
  mainTurnTimerMax = 30,
  startingCash = 1500,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onKickPlayer,
  onQuitGame,
  onAddBot,
  onStartGame,
  onRemovePlayer,
  isConnected,
}) => {
  // Mode selection before entering room: 'create' or 'join'
  const [mode, setMode] = useState<'create' | 'join'>('create');
  
  // Create Room fields
  const [createRoomId, setCreateRoomId] = useState(() => `VN${Math.floor(1000 + Math.random() * 9000)}`);
  const [cfgMaxPlayers, setCfgMaxPlayers] = useState<number>(4);
  const [cfgTurnTime, setCfgTurnTime] = useState<number>(30); // default 30s, max 60s
  const [cfgStartingCash, setCfgStartingCash] = useState<number>(1500); // default 1500
  const [endRuleType, setEndRuleType] = useState<EndRuleType>('max_rolls');
  const [endRuleValue, setEndRuleValue] = useState<number>(90); // default 90 rolls

  // Join Room fields
  const [joinRoomId, setJoinRoomId] = useState(roomId || '');

  // Shared player profile
  const [playerName, setPlayerName] = useState(() => getRandomName());
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(ROBLOX_AVATARS[0].id);
  const [copied, setCopied] = useState(false);

  const handleRandomizeName = () => {
    setPlayerName(getRandomName());
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onCreateRoom({
      roomId: createRoomId.trim().toUpperCase(),
      name: playerName.trim(),
      avatarId: selectedAvatarId,
      maxPlayers: Number(cfgMaxPlayers),
      mainTurnTimer: Math.max(15, Math.min(60, Number(cfgTurnTime))),
      startingCash: Math.max(500, Math.min(5000, Number(cfgStartingCash))),
      endRule: {
        type: endRuleType,
        value: endRuleValue,
      },
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !joinRoomId.trim()) return;
    onJoinRoom(joinRoomId.trim().toUpperCase(), playerName.trim(), selectedAvatarId);
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedAvatar = ROBLOX_AVATARS.find((a) => a.id === selectedAvatarId) || ROBLOX_AVATARS[0];
  const isHost = currentUserId ? currentUserId === hostId : players.length > 0 && players[0].id === currentUserId;
  const myPlayer = players.find((p) => p.id === currentUserId);
  const inRoom = players.length > 0 && Boolean(myPlayer);

  // Ready conditions for starting game:
  // 1. Must reach exactly maxPlayers
  const isFullRoom = players.length === maxPlayers;
  // 2. All guests (non-host and non-bots) must be ready
  const allGuestsReady = players
    .filter((p) => p.id !== hostId && !p.isBot)
    .every((p) => p.isReady);
  const canStartGame = isHost && isFullRoom && allGuestsReady;

  return (
    <div className="min-h-screen bg-[#062016] text-white flex flex-col items-center justify-center p-3 md:p-6">
      {/* Brand Header */}
      <div className="text-center mb-5 max-w-xl animate-in fade-in duration-300">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold mb-2.5 backdrop-blur-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Game Cờ Tỷ Phú Bản Đồ Việt Nam Online Multiplayer</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-amber-300 tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
          CỜ TỶ PHÚ VIỆT NAM
        </h1>
        <p className="text-xs md:text-sm text-slate-300 mt-1.5 font-medium">
          Tranh tài mua đất, xây dựng bất động sản, đấu giá và trở thành đại phú hào độc nhất!
        </p>
      </div>

      <div className="w-full max-w-2xl bg-[#fffef7] text-[#1e293b] rounded-3xl border-4 border-[#1e293b] shadow-2xl p-5 md:p-8 flex flex-col gap-6">
        {!inRoom ? (
          /* CHOICE 1 & 2: CREATE ROOM (HOST) OR JOIN ROOM (GUEST) */
          <div>
            {/* Mode Toggle Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-200 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-3 px-4 rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mode === 'create'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>1. Tạo Phòng Mới (Chủ Phòng)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-3 px-4 rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mode === 'join'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>2. Tham Gia Phòng (Nhập Mã)</span>
              </button>
            </div>

            {/* Profile configuration (Name & Roblox Avatar) */}
            <div className="mb-6 space-y-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              {/* Random Player Name Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black uppercase text-stone-600">
                    Tên Người Chơi (Ngẫu nhiên hoặc tự nhập)
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomizeName}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Đổi tên khác</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={25}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-stone-300 bg-white font-bold text-sm focus:border-emerald-600 focus:outline-hidden"
                  placeholder="Nhập tên của bạn..."
                  required
                />
              </div>

              {/* Roblox Avatar Picker */}
              <div>
                <label className="block text-xs font-black uppercase text-stone-600 mb-2">
                  Chọn Quân Cờ Avatar Roblox ({selectedAvatar.name})
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {ROBLOX_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`p-1.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedAvatarId === av.id
                          ? 'border-emerald-600 bg-emerald-50 scale-105 shadow-md ring-2 ring-emerald-500/40'
                          : 'border-stone-200 hover:border-stone-400 bg-white'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-lg border-2 border-slate-900 flex flex-col items-center justify-center relative shadow-xs"
                        style={{ backgroundColor: av.color }}
                      >
                        <span className="text-[11px] leading-none">{av.hat}</span>
                        <span className="text-[11px] leading-none">{av.face}</span>
                      </div>
                      <span className="text-[9px] font-extrabold text-stone-700 truncate w-full text-center">
                        {av.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FORM 1: CREATE ROOM (HOST) */}
            {mode === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="bg-[#faf8ee] p-4 rounded-2xl border-2 border-amber-300/80 space-y-3.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-800 pb-1 border-b border-amber-200">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span>Thiết Lập Phòng Chơi Của Bạn</span>
                  </div>

                  {/* Room Code */}
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">
                      Mã Phòng (Bạn có thể đổi hoặc để mã ngẫu nhiên)
                    </label>
                    <input
                      type="text"
                      value={createRoomId}
                      onChange={(e) => setCreateRoomId(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border-2 border-stone-300 font-mono font-black text-sm uppercase bg-white"
                      required
                    />
                  </div>

                  {/* Max Players (2 to 10 players) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-stone-700">
                        Số người chơi yêu cầu trong phòng (Chỉ đúng số lượng này mới được bắt đầu):
                      </label>
                      <span className="font-black text-emerald-700 font-mono text-sm">
                        {cfgMaxPlayers} Người
                      </span>
                    </div>
                    <div className="grid grid-cols-5 md:grid-cols-9 gap-1.5">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCfgMaxPlayers(num)}
                          className={`py-1.5 rounded-lg font-black text-xs cursor-pointer border transition-all ${
                            cfgMaxPlayers === num
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main Turn Timer (default 30s, max 60s) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Thời gian suy nghĩ lượt chính:</span>
                      </label>
                      <span className="font-black text-amber-700 font-mono text-sm">
                        {cfgTurnTime} Giây (Mặc định 30s, Tối đa 60s)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={60}
                      step={5}
                      value={cfgTurnTime}
                      onChange={(e) => setCfgTurnTime(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Starting Cash (default 1500) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Số tiền khởi điểm mỗi người:</span>
                      </label>
                      <span className="font-black text-emerald-700 font-mono text-sm">
                        {cfgStartingCash}$
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1000, 1500, 2000, 3000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCfgStartingCash(amt)}
                          className={`py-1.5 rounded-lg font-black text-xs cursor-pointer border transition-all ${
                            cfgStartingCash === amt
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {amt}$ {amt === 1500 ? '(Chuẩn)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quy định cách cuộc chơi dừng (Requirement 5) */}
                  <div className="pt-2 border-t border-amber-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-600" />
                        <span>Quy Định Cách Cuộc Chơi Dừng (Luật Kết Thúc):</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => { setEndRuleType('max_rolls'); setEndRuleValue(90); }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          endRuleType === 'max_rolls'
                            ? 'bg-amber-100 border-amber-600 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-black text-xs text-stone-900 flex items-center gap-1">
                          <span>🎲 Sau số lượt đổ xúc xắc</span>
                        </div>
                        <div className="text-[10.5px] text-stone-600 mt-0.5 leading-snug">
                          Dừng sau số lượt quy định và tính tổng tài sản xếp hạng.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setEndRuleType('time_limit'); setEndRuleValue(15); }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          endRuleType === 'time_limit'
                            ? 'bg-amber-100 border-amber-600 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-black text-xs text-stone-900 flex items-center gap-1">
                          <span>⏰ Giới hạn thời gian thi đấu</span>
                        </div>
                        <div className="text-[10.5px] text-stone-600 mt-0.5 leading-snug">
                          Hết giờ sẽ dừng ngay và tính tổng tài sản.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setEndRuleType('target_cash'); setEndRuleValue(4000); }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          endRuleType === 'target_cash'
                            ? 'bg-amber-100 border-amber-600 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-black text-xs text-stone-900 flex items-center gap-1">
                          <span>🎯 Chạm mốc tài sản mục tiêu</span>
                        </div>
                        <div className="text-[10.5px] text-stone-600 mt-0.5 leading-snug">
                          Ai đạt mốc tài sản đầu tiên sẽ chiến thắng ngay.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setEndRuleType('bankruptcy'); setEndRuleValue(0); }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          endRuleType === 'bankruptcy'
                            ? 'bg-amber-100 border-amber-600 shadow-xs ring-1 ring-amber-500'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-black text-xs text-stone-900 flex items-center gap-1">
                          <span>⚔️ Đấu loại sinh tồn (Cổ điển)</span>
                        </div>
                        <div className="text-[10.5px] text-stone-600 mt-0.5 leading-snug">
                          Chơi đến khi tất cả đối thủ đều phá sản.
                        </div>
                      </button>
                    </div>

                    {/* Sub-selector for value depending on chosen type */}
                    {endRuleType === 'max_rolls' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-white p-2 rounded-xl border border-stone-300">
                        <span className="text-xs font-bold text-stone-600 shrink-0">Chọn số lượt đổ:</span>
                        <div className="flex gap-1.5 flex-1 w-full">
                          {[50, 75, 90, 120].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setEndRuleValue(num)}
                              className={`flex-1 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                                endRuleValue === num
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              {num} {num === 90 ? 'lượt (chuẩn)' : 'lượt'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {endRuleType === 'time_limit' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-white p-2 rounded-xl border border-stone-300">
                        <span className="text-xs font-bold text-stone-600 shrink-0">Chọn thời lượng:</span>
                        <div className="flex gap-1.5 flex-1 w-full">
                          {[10, 15, 20, 30].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setEndRuleValue(mins)}
                              className={`flex-1 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                                endRuleValue === mins
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              {mins} phút
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {endRuleType === 'target_cash' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-white p-2 rounded-xl border border-stone-300">
                        <span className="text-xs font-bold text-stone-600 shrink-0">Mục tiêu tài sản:</span>
                        <div className="flex gap-1.5 flex-1 w-full">
                          {[3000, 4000, 5000].map((cash) => (
                            <button
                              key={cash}
                              type="button"
                              onClick={() => setEndRuleValue(cash)}
                              className={`flex-1 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                                endRuleValue === cash
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              {cash}$
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-base shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Crown className="w-5 h-5 text-amber-300" />
                  <span>Tạo Phòng Chơi Mới &amp; Làm Chủ Phòng</span>
                </button>
              </form>
            ) : (
              /* FORM 2: JOIN ROOM (GUEST) */
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div className="bg-[#f0f9ff] p-4 rounded-2xl border-2 border-sky-300 space-y-3">
                  <label className="block text-xs font-black uppercase text-sky-900">
                    Nhập Mã Phòng Để Tham Gia (Do Chủ Phòng Cung Cấp)
                  </label>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    placeholder="ví dụ: VN8429, BANBE, VIETNAM..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-sky-400 bg-white font-mono font-black text-base uppercase focus:outline-hidden"
                    required
                  />
                  <p className="text-[11px] text-sky-800">
                    💡 Hãy xin mã phòng từ bạn bè là Chủ Phòng để vào cùng bàn cờ.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-black text-base shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Tham Gia Phòng Chơi Ngay</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          /* INSIDE ROOM WAITING AREA */
          <div className="space-y-5">
            {/* Header with Room Code & Host info */}
            <div className="p-4 rounded-2xl bg-[#faf8ee] border-2 border-stone-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-500 uppercase">Mã Phòng Chơi:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                    {isHost ? '👑 Bạn là Chủ Phòng' : '🎮 Bạn là Thành Viên'}
                  </span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-wider font-mono">
                  #{roomId}
                </h3>
                <div className="text-xs text-stone-600 font-medium mt-1 flex flex-wrap gap-2">
                  <span>Cần đủ: <strong className="text-slate-900">{maxPlayers} người</strong></span>
                  <span>•</span>
                  <span>Lượt chính: <strong className="text-slate-900">{mainTurnTimerMax}s</strong></span>
                  <span>•</span>
                  <span>Vốn khởi điểm: <strong className="text-slate-900">{startingCash}$</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyRoomCode}
                  className="py-2 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-900" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Đã sao chép mã!' : 'Sao chép mã phòng'}</span>
                </button>
                <button
                  onClick={onQuitGame}
                  className="py-2 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Thoát khỏi phòng"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Rời phòng</span>
                </button>
              </div>
            </div>

            {/* Players List with Kick button for host (Requirement 6 & 7) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-stone-700">
                    Danh Sách Người Chơi ({players.length}/{maxPlayers} người)
                  </span>
                  {!isFullRoom && (
                    <span className="text-[11px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                      Thiếu {maxPlayers - players.length} người để bắt đầu
                    </span>
                  )}
                </div>

                {isHost && players.length < maxPlayers && (
                  <button
                    onClick={onAddBot}
                    className="py-1 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>+ Thêm Bot Máy ({players.length}/{maxPlayers})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {players.map((p) => {
                  const isPlayerHost = p.id === hostId;
                  const isMe = p.id === currentUserId;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-2xl border-2 flex items-center justify-between shadow-xs transition-all ${
                        p.isReady || isPlayerHost
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RobloxToken player={p} size="sm" isMe={isMe} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-stone-900">{p.name}</span>
                            {isMe && (
                              <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full">
                                BẠN
                              </span>
                            )}
                            {isPlayerHost && (
                              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <Crown className="w-3 h-3 text-amber-900" />
                                <span>Chủ Phòng</span>
                              </span>
                            )}
                            {p.isBot && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
                                Bot
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isPlayerHost ? (
                              <span className="text-[11px] text-amber-800 font-bold">Chủ phòng</span>
                            ) : p.isReady ? (
                              <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã Sẵn Sàng</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Chưa Sẵn Sàng</span>
                              </span>
                            )}
                            <span className="text-[11px] text-stone-400">• Vốn: {startingCash}$</span>
                          </div>
                        </div>
                      </div>

                      {/* Requirement 7: Host has power to kick any other player at any time */}
                      {isHost && !isMe && (
                        <button
                          onClick={() => onKickPlayer(p.id)}
                          className="py-1 px-2.5 rounded-lg bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                          title="Đuổi người chơi này ra khỏi phòng"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Kick</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION SECTION (Host Start vs Guest Ready) */}
            <div className="pt-2 border-t-2 border-stone-200 space-y-3">
              {isHost ? (
                <div>
                  <button
                    onClick={onStartGame}
                    disabled={!canStartGame}
                    className={`w-full py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                      canStartGame
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-98 animate-pulse'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-6 h-6 fill-current" />
                    <span>Bắt Đầu Trò Chơi ({players.length}/{maxPlayers} Người)</span>
                  </button>

                  {/* Clarification prompt why start is disabled */}
                  {!canStartGame && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-center text-xs text-amber-900 font-bold flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {!isFullRoom
                          ? `Cần đủ ${maxPlayers} người chơi để bắt đầu (hiện có ${players.length}/${maxPlayers}). Bạn có thể bấm "+ Thêm Bot Máy" để đủ số lượng!`
                          : !allGuestsReady
                          ? 'Đang chờ tất cả người chơi bấm nút "Sẵn Sàng"!'
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* GUEST READY TOGGLE (Requirement 6) */
                <div className="space-y-2">
                  <button
                    onClick={onToggleReady}
                    className={`w-full py-3.5 rounded-2xl font-black text-base shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 ${
                      myPlayer?.isReady
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-bounce'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {myPlayer?.isReady ? '✅ BẠN ĐÃ SẴN SÀNG (Bấm để hủy)' : '⚡ BẤM ĐỂ SẴN SÀNG NGAY'}
                    </span>
                  </button>
                  <p className="text-center text-xs text-stone-500 font-medium">
                    Sau khi bạn sẵn sàng và phòng đủ {maxPlayers} người, Chủ phòng sẽ bấm Bắt đầu trận đấu!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
