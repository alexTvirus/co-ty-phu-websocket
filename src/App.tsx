import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  GameState, 
  Player, 
  SpaceData, 
  ChatMessage, 
  ServerMessage, 
  ClientAction 
} from './types/monopoly';
import { MONOPOLY_SPACES } from './data/monopolyBoard';
import { MonopolyBoard } from './components/MonopolyBoard';
import { SpaceCardModal } from './components/SpaceCardModal';
import { ManagementModal } from './components/ManagementModal';
import { TradeModal } from './components/TradeModal';
import { AuctionModal } from './components/AuctionModal';
import { ChatBox } from './components/ChatBox';
import { Lobby } from './components/Lobby';
import { LittleJSCanvas } from './components/LittleJSCanvas';
import { RobloxToken } from './components/RobloxToken';
import { sounds } from './utils/soundEffects';
import { 
  Dice5, 
  Trophy, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Home, 
  ShieldCheck, 
  Clock, 
  Bell, 
  Building2,
  Lock,
  SkipForward,
  X,
  LogOut,
  Users
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<SpaceData | null>(null);
  const [showManagement, setShowManagement] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showMyTurnToast, setShowMyTurnToast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animatingPlayerId, setAnimatingPlayerId] = useState<string | null>(null);
  const [animatingPath, setAnimatingPath] = useState<number[]>([]);
  const [sparks, setSparks] = useState<{ x: number; y: number; count?: number; color?: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('vietnam');
  const [dismissedDrawnCard, setDismissedDrawnCard] = useState(false);
  const [drawnCardTimer, setDrawnCardTimer] = useState<number>(7);
  const [showVictoryModal, setShowVictoryModal] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const lastTurnPlayerIdRef = useRef<string | null>(null);
  const autoOpenedSpaceIdRef = useRef<number | null>(null);

  // Auto-close drawnCard popup after 7 seconds if not manually closed (Requirement 4)
  useEffect(() => {
    if (gameState?.drawnCard && !dismissedDrawnCard) {
      setDrawnCardTimer(7);
      const interval = setInterval(() => {
        setDrawnCardTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setDismissedDrawnCard(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.drawnCard, dismissedDrawnCard]);

  // Prevent modals from stacking/overlapping (Requirement 4)
  useEffect(() => {
    if (gameState?.auction) {
      setSelectedSpace(null);
      setShowManagement(false);
      setShowTrade(false);
    }
  }, [gameState?.auction]);

  useEffect(() => {
    if (gameState?.activeCardModal) {
      setShowManagement(false);
      setShowTrade(false);
    }
  }, [gameState?.activeCardModal]);

  const handleReturnToLobby = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'QUIT_GAME' }));
    }
    setGameState(null);
    setSelectedSpace(null);
    setShowVictoryModal(true);
  };

  // Initialize sound settings
  const toggleSound = () => {
    sounds.enabled = !sounds.enabled;
    setSoundEnabled(sounds.enabled);
  };

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;

        if (msg.type === 'ROOM_STATE') {
          setGameState(msg.state);
          const effectiveUserId = msg.yourPlayerId || currentUserId;
          if (msg.yourPlayerId) {
            setCurrentUserId(msg.yourPlayerId);
          }

          // Reset dismissed drawn card when drawn card clears
          if (!msg.state.drawnCard) {
            setDismissedDrawnCard(false);
          }

          // Requirement 4: ONLY pop up activeCardModal on the screen of the active player!
          const activePlayer = msg.state.players[msg.state.currentPlayerIndex];
          const isMyTurnNow = Boolean(activePlayer && effectiveUserId && activePlayer.id === effectiveUserId);

          if (msg.state.activeCardModal && isMyTurnNow) {
            const sp = MONOPOLY_SPACES[msg.state.activeCardModal.spaceId];
            if (sp) {
              setSelectedSpace(sp);
              autoOpenedSpaceIdRef.current = sp.id;
            }
          } else if (!msg.state.activeCardModal && autoOpenedSpaceIdRef.current !== null) {
            // Auto close if it was opened by landing and server closed it
            setSelectedSpace(null);
            autoOpenedSpaceIdRef.current = null;
          }

          // Trigger confetti if game ended
          if (msg.state.status === 'ended') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            sounds.playWin();
          }
        } else if (msg.type === 'KICKED') {
          // Requirement 2: Return player to initial lobby screen when kicked
          alert(msg.message || 'Bạn đã bị chủ phòng kick khỏi trò chơi!');
          setGameState(null);
          setSelectedSpace(null);
          setShowManagement(false);
          setShowTrade(false);
        } else if (msg.type === 'CHAT_MESSAGE') {
          setChatMessages((prev) => [...prev, msg.message]);
        } else if (msg.type === 'PLAYER_MOVED') {
          setAnimatingPlayerId(msg.playerId);
          setAnimatingPath(msg.path);
          setTimeout(() => {
            setAnimatingPlayerId(null);
            setAnimatingPath([]);
          }, msg.path.length * 150 + 200);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Requirement 2: Return to initial screen on disconnect
      setGameState(null);
      setSelectedSpace(null);
      setShowManagement(false);
      setShowTrade(false);
      // Auto reconnect
      setTimeout(connectWebSocket, 2000);
    };

    wsRef.current = socket;
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // Requirement 2: Detect when turn transitions to current user and trigger horizontal slide-in toast
  useEffect(() => {
    if (!gameState || gameState.status !== 'playing' || !currentUserId) return;
    const curr = gameState.players[gameState.currentPlayerIndex];
    if (curr && curr.id === currentUserId && lastTurnPlayerIdRef.current !== currentUserId) {
      setShowMyTurnToast(true);
      sounds.playCash();
      const timer = setTimeout(() => {
        setShowMyTurnToast(false);
      }, 4000);
      lastTurnPlayerIdRef.current = currentUserId;
      return () => clearTimeout(timer);
    } else if (curr && curr.id !== currentUserId) {
      lastTurnPlayerIdRef.current = curr.id;
    }
  }, [gameState?.currentPlayerIndex, gameState?.status, currentUserId]);

  // Send action to server
  const sendAction = (action: ClientAction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
      sounds.playClick();
    }
  };

  // Join Room
  const handleJoinRoom = (rId: string, name: string, avatarId: string) => {
    setRoomId(rId);
    sendAction({
      type: 'JOIN_ROOM',
      roomId: rId,
      name,
      avatarId,
    });
  };

  // Roll Dice
  const handleRollDice = () => {
    sounds.playDiceRoll(3500);
    sendAction({ type: 'ROLL_DICE' });
  };

  // End Turn voluntarily (Requirement 4)
  const handleEndTurn = () => {
    sounds.playClick();
    sendAction({ type: 'END_TURN' });
    setSelectedSpace(null);
  };

  // Space Card click
  const handleSpaceClick = (space: SpaceData) => {
    sounds.playClick();
    setSelectedSpace(space);
  };

  // Buy Property
  const handleBuyProperty = (spaceId: number) => {
    sounds.playCash();
    sendAction({ type: 'BUY_PROPERTY', spaceId });
    setSelectedSpace(null);
    setSparks({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 35, color: '#10b981' });
  };

  // Pass Property -> triggers auction (Requirement 5)
  const handlePassProperty = (spaceId: number) => {
    sounds.playClick();
    sendAction({ type: 'PASS_PROPERTY', spaceId });
    setSelectedSpace(null);
  };

  // Upgrade property
  const handleUpgradeProperty = (spaceId: number) => {
    sounds.playCash();
    sendAction({ type: 'UPGRADE_PROPERTY', spaceId });
    setSparks({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 25, color: '#f59e0b' });
  };

  // Close Card Modal
  const handleCloseCardModal = () => {
    if (gameState?.turnPhase === 'ACTION_DECISION' && gameState.activeCardModal?.spaceId === selectedSpace?.id) {
      sendAction({ type: 'PASS_ACTION' });
    }
    setSelectedSpace(null);
  };

  // Current Player info
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const myPlayer = gameState?.players.find((p) => p.id === currentUserId);
  const isMyTurn = currentPlayer?.id === currentUserId;

  // Turn thinking countdown percentage (Item 7)
  const turnTimerPercent = gameState
    ? Math.max(0, (gameState.currentTurnTimeLeft / gameState.turnTimerMax) * 100)
    : 100;

  // If still in lobby or not joined
  if (!gameState || gameState.status === 'lobby') {
    return (
      <Lobby
        roomId={roomId}
        players={gameState?.players || []}
        currentUserId={currentUserId}
        hostId={gameState?.hostId || ''}
        maxPlayers={gameState?.maxPlayers || 4}
        mainTurnTimerMax={gameState?.mainTurnTimerMax || 30}
        startingCash={gameState?.startingCash || 1500}
        onCreateRoom={(config) => {
          if (config.roomId) setRoomId(config.roomId);
          sendAction({
            type: 'CREATE_ROOM',
            ...config,
          });
        }}
        onJoinRoom={handleJoinRoom}
        onToggleReady={() => sendAction({ type: 'TOGGLE_READY' })}
        onKickPlayer={(pId) => sendAction({ type: 'KICK_PLAYER', playerId: pId })}
        onQuitGame={() => sendAction({ type: 'QUIT_GAME' })}
        onAddBot={() => sendAction({ type: 'ADD_BOT' })}
        onStartGame={() => sendAction({ type: 'START_GAME' })}
        onRemovePlayer={(pId) => sendAction({ type: 'REMOVE_PLAYER', playerId: pId })}
        isConnected={isConnected}
      />
    );
  }

  // Find owner of currently selected space
  const selectedSpaceOwner = selectedSpace
    ? gameState.players.find((p) => p.properties.some((pr) => pr.spaceId === selectedSpace.id))
    : undefined;

  const canBuySelectedSpace =
    Boolean(
      isMyTurn &&
      gameState.turnPhase === 'ACTION_DECISION' &&
      gameState.activeCardModal?.spaceId === selectedSpace?.id &&
      gameState.activeCardModal?.canAct &&
      selectedSpace?.price &&
      myPlayer &&
      myPlayer.cash >= selectedSpace.price
    );

  const canUpgradeSelectedSpace =
    Boolean(
      selectedSpace &&
      myPlayer &&
      myPlayer.properties.some((p) => p.spaceId === selectedSpace.id && p.houses < 5) &&
      selectedSpace.houseCost &&
      myPlayer.cash >= selectedSpace.houseCost
    );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* Particle Canvas */}
      <LittleJSCanvas triggerSparks={sparks} />

      {/* TOP HEADER & TURN PROGRESS BAR */}
      <header className="bg-[#1e293b] border-b-2 border-slate-700 px-4 py-2.5 flex flex-col gap-2 z-20 shadow-md">
        <div className="flex items-center justify-between">
          {/* Logo / Game Title */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎲</span>
            <div>
              <h1 className="text-sm md:text-base font-black text-amber-300 leading-tight">
                CỜ TỶ PHÚ VIỆT NAM
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold">
                Phòng #{gameState.roomId} • {gameState.players.length} người chơi
              </span>
            </div>
          </div>

          {/* Turn status indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-700">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-400">Đang đến lượt: </span>
                <span
                  className="font-extrabold px-2 py-0.5 rounded-full text-white text-[11px]"
                  style={{ backgroundColor: currentPlayer?.color || '#3b82f6' }}
                >
                  {currentPlayer?.name} {isMyTurn ? '(BẠN)' : ''}
                </span>
                <span className="font-mono font-bold text-amber-400 ml-1.5">
                  {gameState.currentTurnTimeLeft}s
                </span>
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            </button>

            {/* Quit Game button (Requirement 1) */}
            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn thoát khỏi ván cờ này không?')) {
                  sendAction({ type: 'QUIT_GAME' });
                }
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="Thoát khỏi ván đấu"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden md:inline">Thoát</span>
            </button>
          </div>
        </div>

        {/* Turn Progress Bar (Requirement 1: no process countdown if game ended, Requirement 4: solid red) */}
        {gameState.status === 'playing' && (
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${turnTimerPercent}%` }}
            />
          </div>
        )}
      </header>

      {/* HORIZONTAL SLIDE-IN TOAST WHEN IT IS YOUR TURN (Requirement 2) */}
      {showMyTurnToast && gameState.status === 'playing' && (
        <div className="fixed top-14 left-0 right-0 z-50 flex items-center justify-center pointer-events-none px-4">
          <div className="max-w-lg w-full bg-amber-500 text-slate-950 px-6 py-3.5 rounded-2xl shadow-2xl border-2 border-white flex items-center justify-between pointer-events-auto animate-in slide-in-from-right-full duration-500 ease-out">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🔔</span>
              <div>
                <h4 className="font-black text-sm md:text-base tracking-wide uppercase text-slate-950">
                  ĐÃ ĐẾN LƯỢT CỦA BẠN!
                </h4>
                <p className="text-xs font-bold text-slate-900/90">
                  Hãy gieo xúc xắc hoặc đưa ra quyết định của bạn ngay!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMyTurnToast(false)}
              className="text-slate-950 font-black text-xs px-2.5 py-1.5 bg-white/40 hover:bg-white/60 rounded-xl cursor-pointer transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* PLAYERS HORIZONTAL BAR (Requirement 1 & 7) */}
      <div className="bg-[#1e293b]/70 backdrop-blur-xs border-b border-slate-700/60 px-3 py-6 overflow-x-auto flex items-center gap-2.5 z-10 scrollbar-none">
        {gameState.players.map((p) => {
          const isTurn = currentPlayer?.id === p.id;
          const isMe = p.id === currentUserId;
          const isDead = p.isBankrupt || p.isDisconnected || p.isQuit;
          const isHost = gameState.hostId === currentUserId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all shrink-0 ${
                isDead
                  ? 'opacity-50 bg-black/90 border-black line-through text-stone-500'
                  : isTurn
                  ? 'bg-amber-500/20 border-amber-400 shadow-md scale-102 ring-2 ring-amber-400/40'
                  : 'bg-slate-800/80 border-slate-700'
              }`}
            >
              <RobloxToken 
                player={p} 
                size="sm" 
                isCurrentTurn={isTurn} 
                turnTimeLeft={isTurn ? gameState.currentTurnTimeLeft : undefined}
                turnTimeMax={gameState.turnTimerMax}
                isMe={isMe}
              />
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-black truncate max-w-[90px] ${isDead ? 'line-through text-stone-500' : ''}`}>
                    {p.name}
                  </span>
                  {isMe && <span className="text-[9px] bg-emerald-500 text-white font-bold px-1 rounded">Bạn</span>}
                  {p.id === gameState.hostId && <span className="text-[9px] bg-amber-400 text-slate-950 font-bold px-1 rounded">Chủ</span>}
                  {p.inJail && !isDead && <span className="text-[9px] bg-rose-600 text-white font-bold px-1 rounded">Ở Tù</span>}
                  {isDead && (
                    <span className="text-[9px] bg-stone-900 border border-stone-700 text-rose-400 font-bold px-1 rounded">
                      {p.isDisconnected ? 'Mất kết nối' : p.isQuit ? 'Đã rời' : 'Phá sản'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-extrabold text-emerald-400 font-mono">
                  {isDead ? (p.isDisconnected ? 'Mất kết nối' : 'Đã rời') : `${p.cash}$`}
                </div>
              </div>

              {/* Requirement 7: Host can kick any other player at any time */}
              {isHost && !isMe && !isDead && (
                <button
                  onClick={() => {
                    if (window.confirm(`Kick ${p.name} ra khỏi phòng?`)) {
                      sendAction({ type: 'KICK_PLAYER', playerId: p.id });
                    }
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-black cursor-pointer shadow-xs"
                  title="Kick người chơi này"
                >
                  Kick
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* MAIN GAME CONTAINER: BOARD & SIDEBAR */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-2 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left / Center: The Monopoly Board */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center">
          <MonopolyBoard
            gameState={gameState}
            currentUserId={currentUserId}
            onSpaceClick={handleSpaceClick}
            onRollDice={handleRollDice}
            onEndTurn={handleEndTurn}
            onOpenManagement={() => setShowManagement(true)}
            onOpenTrade={() => setShowTrade(true)}
            animatingPlayerId={animatingPlayerId}
            animatingPath={animatingPath}
          />
        </div>

        {/* Right Sidebar: Chat & Game History */}
        <div className="lg:col-span-4 flex flex-col gap-3 h-[500px] lg:h-[660px]">
          {/* Quick Stats Card for Me (Requirement 2: show player's name clearly) */}
          {myPlayer && (
            <div className="p-3 rounded-2xl bg-[#1e293b] border-2 border-slate-700 shadow-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <RobloxToken player={myPlayer} size="sm" isCurrentTurn={isMyTurn} isMe={true} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400">Tài khoản của:</span>
                      <span className="text-sm font-black text-amber-300 truncate max-w-[130px]">{myPlayer.name}</span>
                      <span className="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded-full">Bạn</span>
                    </div>
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      {myPlayer.cash}$
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowManagement(true)}
                  className="py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs shadow-xs cursor-pointer transition-all"
                >
                  Quản lý đất ({myPlayer.properties.length})
                </button>
              </div>

              {/* Requirement 1: When game ended, no turn countdown, show action buttons */}
              {gameState.status === 'ended' ? (
                <div className="p-3 rounded-xl bg-slate-900 border-2 border-amber-400 text-center space-y-2">
                  <div className="text-amber-300 font-black text-sm flex items-center justify-center gap-1.5">
                    <span>🏆</span>
                    <span>TRÒ CHƠI ĐÃ KẾT THÚC!</span>
                  </div>
                  <p className="text-[11px] text-stone-300 font-medium">
                    {gameState.players.find(p => p.id === gameState.winnerId)?.name 
                      ? `${gameState.players.find(p => p.id === gameState.winnerId)?.name} chiến thắng!` 
                      : 'Ván đấu đã kết thúc.'}
                  </p>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={handleReturnToLobby}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Trở về màn hình ban đầu</span>
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={handleReturnToLobby}
                        className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                      >
                        Tạo phòng mới
                      </button>
                      <button
                        onClick={handleReturnToLobby}
                        className="py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                      >
                        Tham gia phòng khác
                      </button>
                    </div>
                  </div>
                </div>
              ) : !isMyTurn ? (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-400/30 text-center text-[11px] text-amber-300 font-bold flex items-center justify-center gap-1.5 shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đang trong lượt của {currentPlayer?.name || 'người khác'}. Bạn không thể thực hiện thao tác.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {gameState.turnPhase === 'ROLL_DICE' && (
                    <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-center text-xs font-black text-amber-300">
                      🎲 Hãy gieo xúc xắc ({gameState.rollDiceTimeLeft}s) • Tự gieo khi hết giờ
                    </div>
                  )}
                  {gameState.turnPhase === 'ACTION_DECISION' && (
                    <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/40 text-center text-xs font-black text-sky-200">
                      ⏱️ Quyết định ô đất ({gameState.actionTimeLeft}s) • Lượt chính tạm dừng
                    </div>
                  )}
                  {/* Requirement 4: End turn quick button */}
                  <button
                    onClick={handleEndTurn}
                    className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Chủ động kết thúc lượt ngay"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>
                      {gameState.turnPhase === 'MAIN_TURN'
                        ? `Kết thúc lượt ngay (${gameState.mainTurnTimeLeft}s) ⏭️`
                        : 'Kết thúc lượt ⏭️'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real-time Chat Box (Item 3) */}
          <div className="flex-1 min-h-0">
            <ChatBox
              messages={chatMessages}
              currentUserId={currentUserId}
              onSendMessage={(text) => sendAction({ type: 'SEND_CHAT', text })}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
            />
          </div>
        </div>
      </div>

      {/* SPACE CARD MODAL (Item 8, 9, 11 - Styled after card.PNG) */}
      {selectedSpace && (
        <SpaceCardModal
          space={selectedSpace}
          owner={selectedSpaceOwner}
          isCurrentPlayerTurn={isMyTurn}
          canBuy={canBuySelectedSpace}
          canUpgrade={canUpgradeSelectedSpace}
          actionTimeLeft={
            gameState.turnPhase === 'ACTION_DECISION' && gameState.activeCardModal?.spaceId === selectedSpace.id
              ? gameState.actionTimeLeft
              : undefined
          }
          actionTimerMax={gameState.actionTimerMax}
          onClose={handleCloseCardModal}
          onBuy={() => handleBuyProperty(selectedSpace.id)}
          onPassProperty={() => handlePassProperty(selectedSpace.id)}
          onUpgrade={() => handleUpgradeProperty(selectedSpace.id)}
        />
      )}

      {/* AUCTION MODAL (Requirement 5) */}
      {gameState.auction && (
        <AuctionModal
          gameState={gameState}
          currentUserId={currentUserId}
          onBid={(amount) => sendAction({ type: 'BID', amount })}
          onPassBid={() => sendAction({ type: 'PASS_BID' })}
        />
      )}

      {/* MANAGEMENT MODAL (Item 13) */}
      {showManagement && myPlayer && (
        <ManagementModal
          player={myPlayer}
          gameState={gameState}
          onClose={() => setShowManagement(false)}
          onUpgrade={handleUpgradeProperty}
          onMortgage={(spaceId) => sendAction({ type: 'MORTGAGE_PROPERTY', spaceId })}
          onUnmortgage={(spaceId) => sendAction({ type: 'UNMORTGAGE_PROPERTY', spaceId })}
          onBankrupt={() => sendAction({ type: 'DECLARE_BANKRUPTCY' })}
        />
      )}

      {/* TRADE MODAL */}
      {showTrade && myPlayer && (
        <TradeModal
          player={myPlayer}
          gameState={gameState}
          onClose={() => setShowTrade(false)}
          onSendTradeMessage={(text) => sendAction({ type: 'SEND_CHAT', text })}
        />
      )}

      {/* DRAWN CARD POPUP (Chance / Community Chest) - Only shown to active player, AUTO CLOSES (Requirement 4) */}
      {isMyTurn && gameState.drawnCard && !dismissedDrawnCard && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
          <div
            className={`pointer-events-auto origin-center animate-modal-scale-in w-full max-w-sm rounded-3xl p-6 text-white border-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] flex flex-col items-center text-center relative ${
              gameState.drawnCard.type === 'chance'
                ? 'bg-orange-600 border-amber-300'
                : 'bg-blue-600 border-sky-300'
            }`}
          >
            {/* Top-right close button */}
            <button
              onClick={() => setDismissedDrawnCard(true)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
              title="Đóng thẻ"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl mb-3 shadow-inner">
              {gameState.drawnCard.type === 'chance' ? '❓' : '🧰'}
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-200 mb-1">
              {gameState.drawnCard.type === 'chance' ? 'THẺ CƠ HỘI' : 'THẺ KHÍ VẬN'}
            </span>
            <h3 className="text-2xl font-black mb-2 drop-shadow-md">
              {gameState.drawnCard.title}
            </h3>
            <p className="text-sm text-white/95 font-medium leading-relaxed mb-3">
              {gameState.drawnCard.description}
            </p>

            {/* Auto-close process bar (solid red) - Requirement 4 */}
            <div className="w-full mb-3">
              <div className="flex justify-between text-[11px] font-bold text-white/80 mb-1">
                <span>Tự đóng sau</span>
                <span className="font-mono">{drawnCardTimer}s</span>
              </div>
              <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(drawnCardTimer / 7) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setDismissedDrawnCard(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-extrabold text-sm transition-colors cursor-pointer shadow-md"
            >
              Đóng ngay
            </button>
          </div>
        </div>
      )}

      {/* VICTORY GAME OVER POPUP (Requirement 1 & 5) */}
      {gameState.status === 'ended' && showVictoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in duration-300">
          <div className="w-full max-w-lg rounded-3xl bg-[#fffef7] text-[#1e293b] border-4 border-amber-400 p-5 md:p-7 shadow-2xl flex flex-col items-center text-center relative max-h-[90vh] overflow-y-auto">
            {/* Close button to view board */}
            <button
              onClick={() => setShowVictoryModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
              title="Xem lại bàn cờ"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-amber-400 flex items-center justify-center text-3xl shadow-lg mb-2 animate-bounce">
              🏆
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-600 mb-0.5">
              VÁN ĐẤU HOÀN TẤT
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
              {gameState.players.find((p) => p.id === gameState.winnerId)?.name || 'Người chơi'} CHIẾN THẮNG!
            </h2>
            <p className="text-xs text-stone-600 mb-4 font-semibold px-2">
              {gameState.endReason || (gameState.players.filter(p => !p.isBankrupt && !p.isDisconnected && !p.isQuit).length <= 1
                ? 'Tất cả đối thủ đã rời phòng hoặc mất kết nối! Bạn là người chiến thắng duy nhất!'
                : 'Đã thâu tóm toàn bộ bất động sản và trở thành Đại Phú Hào!')}
            </p>

            {/* Complete Leaderboard Breakdown (Requirement 5) */}
            {gameState.leaderboard && gameState.leaderboard.length > 0 && (
              <div className="w-full bg-[#faf8ee] border-2 border-stone-300 rounded-2xl p-3 mb-4 text-left">
                <div className="text-[11px] font-black uppercase text-stone-600 mb-2 flex items-center justify-between">
                  <span>Bảng Xếp Hạng Tổng Tài Sản</span>
                  <span className="text-[9.5px] text-stone-500 font-normal">Tiền mặt + Bất động sản</span>
                </div>
                <div className="space-y-1.5">
                  {gameState.leaderboard.map((item) => (
                    <div
                      key={item.playerId}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all ${
                        item.rank === 1
                          ? 'bg-amber-100/90 border-amber-400 text-stone-900 shadow-xs'
                          : 'bg-white border-stone-200 text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                          item.rank === 1 ? 'bg-amber-400 text-slate-950' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-extrabold truncate max-w-[120px]">{item.name}</span>
                      </div>

                      <div className="flex items-center gap-2.5 text-right">
                        <span className="text-[10px] text-stone-500 hidden sm:inline">
                          Tiền: {item.cash}$ • BĐS: {item.propertyValue + item.houseValue}$
                        </span>
                        <span className="font-black text-emerald-700 text-xs sm:text-sm font-mono">
                          {item.totalNetWorth}$
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full space-y-2.5">
              <button
                onClick={handleReturnToLobby}
                className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Trở về màn hình ban đầu</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleReturnToLobby}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tạo phòng mới</span>
                </button>
                <button
                  onClick={handleReturnToLobby}
                  className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Tham gia phòng khác</span>
                </button>
              </div>

              <button
                onClick={() => setShowVictoryModal(false)}
                className="w-full py-2 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Ở lại xem lại bàn cờ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner when staying in room after game ended (Requirement 1) */}
      {gameState.status === 'ended' && !showVictoryModal && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-[#0f2d1e] border-2 border-amber-400 rounded-2xl px-4 py-2 text-white shadow-2xl flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <span className="text-xs font-black text-amber-300">
            Trò chơi kết thúc! {gameState.players.find((p) => p.id === gameState.winnerId)?.name} thắng!
          </span>
          <button
            onClick={handleReturnToLobby}
            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer ml-1"
          >
            Trở về màn hình ban đầu
          </button>
          <button
            onClick={() => setShowVictoryModal(true)}
            className="px-2.5 py-1 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold cursor-pointer"
          >
            Xem bảng kết quả
          </button>
        </div>
      )}
    </div>
  );
}
