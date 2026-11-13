import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  GameState, 
  Player, 
  ClientAction, 
  ServerMessage, 
  ChatMessage, 
  Card,
  GameEndRule,
  PlayerNetWorth
} from './src/types/monopoly.js';
import { 
  MONOPOLY_SPACES, 
  COLOR_GROUPS, 
  ROBLOX_AVATARS, 
  CHANCE_CARDS, 
  CHEST_CARDS,
  getRandomName 
} from './src/data/monopolyBoard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface RoomSession {
  roomId: string;
  state: GameState;
  clients: Map<string, WebSocket>; // playerId -> socket
  timerInterval?: NodeJS.Timeout;
  botTimeout?: NodeJS.Timeout;
}

const rooms = new Map<string, RoomSession>();

function broadcastToRoom(room: RoomSession, message: ServerMessage, excludePlayerId?: string) {
  const json = JSON.stringify(message);
  for (const [pId, socket] of room.clients.entries()) {
    if (excludePlayerId && pId === excludePlayerId) continue;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(json);
    }
  }
}

function sendToPlayer(room: RoomSession, playerId: string, message: ServerMessage) {
  const socket = room.clients.get(playerId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

// Requirement 5: Broadcast game event to both history feed AND chat stream
function broadcastGameEvent(room: RoomSession, text: string, color: string = '#f59e0b', senderName: string = 'Hệ Thống') {
  room.state.history.unshift(text);
  if (room.state.history.length > 40) room.state.history.pop();
  broadcastToRoom(room, {
    type: 'CHAT_MESSAGE',
    message: {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: 'system',
      senderName,
      senderColor: color,
      text,
      timestamp: Date.now(),
      isSystem: true,
    },
  });
}

// Distinct, vibrant color palette for each player in room (Requirement 3: no yellow-orange conflict)
export const DISTINCT_PLAYER_COLORS = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#eab308', // Gold / Yellow
  '#9333ea', // Purple
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#475569', // Slate
  '#4f46e5', // Indigo
  '#78350f', // Brown
];

export function getPlayerUniqueColor(existingPlayers: Player[]): string {
  const used = new Set(existingPlayers.map(p => p.color));
  for (const c of DISTINCT_PLAYER_COLORS) {
    if (!used.has(c)) return c;
  }
  return DISTINCT_PLAYER_COLORS[existingPlayers.length % DISTINCT_PLAYER_COLORS.length];
}

// Calculate Net Worth according to Monopoly Rules (Requirement 5)
export function calculatePlayerNetWorth(player: Player): { cash: number; propertyValue: number; houseValue: number; totalNetWorth: number } {
  let propertyValue = 0;
  let houseValue = 0;
  for (const prop of player.properties) {
    const space = MONOPOLY_SPACES[prop.spaceId];
    if (space) {
      if (prop.isMortgaged) {
        propertyValue += (space.mortgageValue || Math.floor((space.price || 0) / 2));
      } else {
        propertyValue += (space.price || 0);
        if (prop.houses > 0) {
          houseValue += prop.houses * (space.houseCost || 50);
        }
      }
    }
  }
  const cash = Math.max(0, player.cash);
  const totalNetWorth = player.isBankrupt ? 0 : (cash + propertyValue + houseValue);
  return { cash, propertyValue, houseValue, totalNetWorth };
}

export function generateLeaderboard(players: Player[]): PlayerNetWorth[] {
  const list: PlayerNetWorth[] = players.map(p => {
    const nw = calculatePlayerNetWorth(p);
    return {
      playerId: p.id,
      name: p.name,
      color: p.color,
      cash: nw.cash,
      propertyValue: nw.propertyValue,
      houseValue: nw.houseValue,
      totalNetWorth: nw.totalNetWorth,
      rank: 1,
    };
  });
  list.sort((a, b) => b.totalNetWorth - a.totalNetWorth);
  list.forEach((item, index) => {
    item.rank = index + 1;
  });
  return list;
}

export function triggerGameEndWithReason(room: RoomSession, reason: string) {
  const state = room.state;
  if (state.status === 'ended') return;
  state.status = 'ended';
  state.turnPhase = 'GAME_OVER';
  state.leaderboard = generateLeaderboard(state.players);
  state.winnerId = state.leaderboard[0]?.playerId || null;
  state.endReason = reason;
  state.currentTurnTimeLeft = 0;
  state.rollDiceTimeLeft = 0;
  state.mainTurnTimeLeft = 0;
  state.actionTimeLeft = 0;
  state.turnTimerMax = 0;
  state.activeCardModal = null;
  state.auction = null;
  state.drawnCard = null;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }
  if (room.botTimeout) {
    clearTimeout(room.botTimeout);
    room.botTimeout = undefined;
  }

  const winner = state.players.find(p => p.id === state.winnerId);
  const winnerName = winner?.name || 'Người chơi';
  const winnerNW = state.leaderboard[0]?.totalNetWorth || 0;
  broadcastGameEvent(
    room,
    `🏁 VÁN ĐẤU KẾT THÚC: ${reason} 🏆 ${winnerName} chiến thắng với tổng tài sản ${winnerNW}$!`,
    '#f59e0b',
    'Kết Thúc'
  );
  broadcastState(room);
}

export function triggerSinglePlayerWin(room: RoomSession, winnerPlayer?: Player) {
  const state = room.state;
  if (state.status === 'ended') return;
  state.status = 'ended';
  state.turnPhase = 'GAME_OVER';
  state.leaderboard = generateLeaderboard(state.players);
  state.winnerId = winnerPlayer?.id || state.leaderboard[0]?.playerId || null;
  state.endReason = 'Tất cả đối thủ đã rời đi hoặc mất kết nối!';
  state.currentTurnTimeLeft = 0;
  state.rollDiceTimeLeft = 0;
  state.mainTurnTimeLeft = 0;
  state.actionTimeLeft = 0;
  state.turnTimerMax = 0;
  state.activeCardModal = null;
  state.auction = null;
  state.drawnCard = null;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }
  if (room.botTimeout) {
    clearTimeout(room.botTimeout);
    room.botTimeout = undefined;
  }

  const winnerName = winnerPlayer?.name || 'Người chơi còn lại';
  broadcastGameEvent(
    room,
    `🏆 ${winnerName} MẶC ĐỊNH CHIẾN THẮNG! Tất cả đối thủ đã rời đi hoặc mất kết nối. Trò chơi dừng lại!`,
    '#f59e0b',
    'Chiến Thắng'
  );
  broadcastState(room);
}

export function checkRemainingActivePlayers(room: RoomSession): boolean {
  if (room.state.status !== 'playing') return false;
  const activePlayers = room.state.players.filter(p => !p.isBankrupt && !p.isDisconnected && !p.isQuit);
  if (activePlayers.length <= 1) {
    triggerSinglePlayerWin(room, activePlayers[0]);
    return true;
  }
  return false;
}

export function checkGameEndConditions(room: RoomSession): boolean {
  const state = room.state;
  if (state.status !== 'playing') return false;

  if (checkRemainingActivePlayers(room)) return true;

  // Check target cash milestone
  if (state.endRule?.type === 'target_cash') {
    const alive = state.players.filter(p => !p.isBankrupt && !p.isDisconnected && !p.isQuit);
    for (const p of alive) {
      const nw = calculatePlayerNetWorth(p);
      if (nw.totalNetWorth >= state.endRule.value) {
        triggerGameEndWithReason(room, `🎯 ${p.name} đã chạm mốc tài sản ${state.endRule.value}$!`);
        return true;
      }
    }
  }

  // Check max rolls
  if (state.endRule?.type === 'max_rolls' && state.totalRollsCount >= state.endRule.value) {
    triggerGameEndWithReason(room, `🎲 Đã hoàn thành giới hạn ${state.endRule.value} lượt đổ xúc xắc!`);
    return true;
  }

  return false;
}

function createDefaultGameState(roomId: string): GameState {
  return {
    roomId,
    hostId: '',
    maxPlayers: 4,
    startingCash: 1500,
    status: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    turnPhase: 'WAITING_TO_START',
    dice: { die1: 1, die2: 2, isRolling: false, isDouble: false, rollCount: 0 },
    currentTurnTimeLeft: 8,
    turnTimerMax: 8,
    rollDiceTimeLeft: 8,
    rollDiceTimerMax: 8,
    mainTurnTimeLeft: 30,
    mainTurnTimerMax: 30,
    actionTimeLeft: 10,
    actionTimerMax: 10,
    activeCardModal: null,
    auction: null,
    drawnCard: null,
    winnerId: null,
    history: ['Phòng chơi đã được khởi tạo. Sẵn sàng bắt đầu!'],
    endRule: { type: 'max_rolls', value: 90 },
    totalRollsCount: 0,
    gameStartTime: 0,
    gameTimeElapsed: 0,
    leaderboard: [],
  };
}

function getOrCreateRoom(roomId: string): RoomSession {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      roomId,
      state: createDefaultGameState(roomId),
      clients: new Map(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

// Calculate Rent logic
function calculateRent(spaceId: number, diceTotal: number, state: GameState): number {
  const space = MONOPOLY_SPACES[spaceId];
  if (!space) return 0;

  // Find owner
  const owner = state.players.find(p => p.properties.some(prop => prop.spaceId === spaceId));
  if (!owner) return 0;
  const propState = owner.properties.find(p => p.spaceId === spaceId);
  if (!propState || propState.isMortgaged) return 0;

  if (space.type === 'property' && space.rent) {
    if (propState.houses > 0) {
      return space.rent[propState.houses + 1] || space.rent[1];
    }
    // Check if full color group owned
    const groupSpaces = COLOR_GROUPS[space.colorGroup] || [];
    const ownsAll = groupSpaces.every(sId => 
      owner.properties.some(p => p.spaceId === sId && !p.isMortgaged)
    );
    return ownsAll ? space.rent[0] * 2 : space.rent[0];
  }

  if (space.type === 'railroad') {
    const stationSpaces = COLOR_GROUPS.station;
    const ownedStations = owner.properties.filter(p => stationSpaces.includes(p.spaceId)).length;
    return 25 * Math.pow(2, Math.max(0, ownedStations - 1));
  }

  if (space.type === 'utility') {
    const utilitySpaces = COLOR_GROUPS.utility;
    const ownedUtilities = owner.properties.filter(p => utilitySpaces.includes(p.spaceId)).length;
    return ownedUtilities === 2 ? diceTotal * 10 : diceTotal * 4;
  }

  return 0;
}

// Bot auto-play logic
function handleBotTurn(room: RoomSession) {
  const state = room.state;
  if (state.status !== 'playing') return;
  const currPlayer = state.players[state.currentPlayerIndex];
  if (!currPlayer || !currPlayer.isBot || currPlayer.isBankrupt) return;

  clearTimeout(room.botTimeout);
  room.botTimeout = setTimeout(() => {
    if (state.turnPhase === 'ROLL_DICE') {
      // If in jail, try pay fine if rich, else roll
      if (currPlayer.inJail) {
        if (currPlayer.cash > 400) {
          payJailFine(room, currPlayer.id);
        } else {
          rollDice(room, currPlayer.id);
        }
      } else {
        rollDice(room, currPlayer.id);
      }
    } else if (state.turnPhase === 'ACTION_DECISION') {
      const spaceId = state.activeCardModal?.spaceId;
      if (spaceId !== undefined && state.activeCardModal?.canAct) {
        const space = MONOPOLY_SPACES[spaceId];
        if (space && space.price && currPlayer.cash >= space.price + 150) {
          buyProperty(room, currPlayer.id, spaceId);
        } else {
          passAction(room, currPlayer.id);
        }
      } else {
        passAction(room, currPlayer.id);
      }
    } else if (state.turnPhase === 'MAIN_TURN') {
      // In main turn, bot finishes its turn
      endPlayerTurn(room);
    }
  }, 1200);
}

// Room Timer Tick (1 second interval)
function startRoomTimer(room: RoomSession) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    const state = room.state;
    if (state.status !== 'playing') return;

    // Track elapsed time and check time limit end rule
    state.gameTimeElapsed = (state.gameTimeElapsed || 0) + 1;
    if (state.endRule?.type === 'time_limit') {
      const limitSeconds = state.endRule.value * 60;
      if (state.gameTimeElapsed >= limitSeconds) {
        triggerGameEndWithReason(room, `⏰ Đã hết thời gian thi đấu ${state.endRule.value} phút!`);
        return;
      }
    }

    const currPlayer = state.players[state.currentPlayerIndex];
    if (!currPlayer) return;

    // Phase 1: Dice Roll Countdown
    if (state.turnPhase === 'ROLL_DICE') {
      if (state.rollDiceTimeLeft > 0) {
        state.rollDiceTimeLeft--;
        state.currentTurnTimeLeft = state.rollDiceTimeLeft;
        state.turnTimerMax = state.rollDiceTimerMax;
        broadcastState(room);
      } else {
        // Auto-roll dice if time expired!
        rollDice(room, currPlayer.id);
      }
    } 
    // Phase 2: Action / Model Card Countdown (Main turn timer is PAUSED)
    else if (state.turnPhase === 'ACTION_DECISION') {
      if (state.actionTimeLeft > 0) {
        state.actionTimeLeft--;
        state.currentTurnTimeLeft = state.actionTimeLeft;
        state.turnTimerMax = state.actionTimerMax;
        broadcastState(room);
      } else {
        // Auto pass decision -> will trigger auction if unowned
        passAction(room, currPlayer.id);
      }
    } 
    // Phase 3: Main Turn Countdown (Resumes after card closes)
    else if (state.turnPhase === 'MAIN_TURN') {
      if (state.mainTurnTimeLeft > 0) {
        state.mainTurnTimeLeft--;
        state.currentTurnTimeLeft = state.mainTurnTimeLeft;
        state.turnTimerMax = state.mainTurnTimerMax;
        broadcastState(room);
      } else {
        // Main turn expired -> end turn automatically
        endPlayerTurn(room);
      }
    } 
    // Phase 4: Auction Countdown
    else if (state.turnPhase === 'AUCTION') {
      if (state.auction) {
        if (state.auction.timeLeft > 0) {
          state.auction.timeLeft--;
          broadcastState(room);
        } else {
          // Time expired for this bidder -> auto pass bid
          passBid(room, state.auction.currentBidderId);
        }
      }
    }
  }, 1000);
}

function broadcastState(room: RoomSession) {
  for (const [pId, socket] of room.clients.entries()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'ROOM_STATE',
        state: room.state,
        yourPlayerId: pId,
      }));
    }
  }
}

// Game Actions
function rollDice(room: RoomSession, playerId: string) {
  const state = room.state;
  const currPlayer = state.players[state.currentPlayerIndex];
  if (!currPlayer || currPlayer.id !== playerId || state.turnPhase !== 'ROLL_DICE' || state.dice.isRolling) return;

  state.totalRollsCount = (state.totalRollsCount || 0) + 1;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const isDouble = d1 === d2;
  const rollCount = isDouble ? state.dice.rollCount + 1 : 0;

  // Set isRolling = true and broadcast immediately for the 3.5s animation
  state.dice = {
    die1: d1,
    die2: d2,
    isRolling: true,
    isDouble,
    rollCount,
  };
  state.history.unshift(`🎲 ${currPlayer.name} đang lắc xúc xắc...`);
  if (state.history.length > 40) state.history.pop();
  broadcastState(room);

  // 3.5 seconds dice tumbling animation
  setTimeout(() => {
    state.dice.isRolling = false;
    const total = d1 + d2;
    broadcastGameEvent(
      room, 
      `🎲 ${currPlayer.name} gieo được ${d1} và ${d2} (Tổng: ${total})${isDouble ? ' ⭐ ĐỔ KÉP!' : ''}`,
      '#f59e0b',
      'Xúc Xắc'
    );
    broadcastState(room);

    // If in jail
    if (currPlayer.inJail) {
      if (isDouble) {
        currPlayer.inJail = false;
        currPlayer.jailTurns = 0;
        broadcastGameEvent(room, `🎉 ${currPlayer.name} đổ được xúc xắc kép và được thả tự do!`, '#10b981', 'Ra Tù');
        movePlayer(room, currPlayer, total);
      } else {
        currPlayer.jailTurns++;
        if (currPlayer.jailTurns >= 3) {
          // Forced to pay 50 or bankrupt
          currPlayer.cash -= 50;
          currPlayer.inJail = false;
          currPlayer.jailTurns = 0;
          broadcastGameEvent(room, `⛓️ ${currPlayer.name} hết 3 lượt trong tù, nộp phạt 50$ để ra tù.`, '#ef4444', 'Tù');
          movePlayer(room, currPlayer, total);
        } else {
          broadcastGameEvent(room, `⛓️ ${currPlayer.name} chưa đổ được kép (lượt ${currPlayer.jailTurns}/3 trong tù).`, '#64748b', 'Tù');
          endPlayerTurn(room);
        }
      }
      return;
    }

    // 3 doubles in a row -> Go to Jail
    if (rollCount >= 3) {
      broadcastGameEvent(room, `🚔 ${currPlayer.name} đổ kép 3 lần liên tiếp! Bị bắt vào tù.`, '#dc2626', 'Tòa Án');
      sendPlayerToJail(room, currPlayer);
      return;
    }

    movePlayer(room, currPlayer, total);
  }, 3500);
}

function sendPlayerToJail(room: RoomSession, player: Player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  room.state.dice.rollCount = 0;
  broadcastGameEvent(room, `🚨 ${player.name} đã bị áp giải VÀO TÙ!`, '#dc2626', 'Tòa Án');
  endPlayerTurn(room);
}

function movePlayer(room: RoomSession, player: Player, steps: number) {
  const state = room.state;
  state.turnPhase = 'MOVING';

  const oldPos = player.position;
  const newPos = (oldPos + steps) % 40;

  // Path for smooth client-side hopping animation
  const path: number[] = [];
  for (let s = 1; s <= steps; s++) {
    path.push((oldPos + s) % 40);
  }

  // Passing GO (+200)
  if (oldPos + steps >= 40) {
    player.cash += 200;
    broadcastGameEvent(room, `💵 ${player.name} đi qua ô Xuất Phát và nhận 200$ lương!`, '#10b981', 'Xuất Phát');
  }

  player.position = newPos;

  // Broadcast the movement animation path to all clients
  broadcastToRoom(room, {
    type: 'PLAYER_MOVED',
    playerId: player.id,
    from: oldPos,
    to: newPos,
    path,
  });

  // Small delay for animation before handling landing
  setTimeout(() => {
    handleLanding(room, player, newPos, steps);
  }, 1000);
}

function handleLanding(room: RoomSession, player: Player, spaceId: number, diceTotal: number) {
  const state = room.state;
  const space = MONOPOLY_SPACES[spaceId];
  if (!space) return;

  switch (space.type) {
    case 'property':
    case 'railroad':
    case 'utility': {
      const owner = state.players.find(p => p.properties.some(prop => prop.spaceId === spaceId));
      if (!owner) {
        // Can buy
        broadcastGameEvent(room, `📍 ${player.name} dừng chân tại [${space.name}] (Giá: ${space.price}$).`, '#3b82f6', 'Dừng Chân');
        state.turnPhase = 'ACTION_DECISION';
        state.actionTimeLeft = 10;
        state.activeCardModal = {
          spaceId,
          canAct: true,
          forcedByLanding: true,
        };
        broadcastState(room);
        handleBotTurn(room);
      } else if (owner.id === player.id) {
        // Landed on own property
        broadcastGameEvent(room, `🏠 ${player.name} thăm lại đất của mình tại [${space.name}].`, '#10b981', 'Đất Nhà');
        state.turnPhase = 'ACTION_DECISION';
        state.actionTimeLeft = 5;
        state.activeCardModal = {
          spaceId,
          canAct: false,
          forcedByLanding: true,
        };
        broadcastState(room);
        handleBotTurn(room);
      } else {
        // Must pay rent!
        const rent = calculateRent(spaceId, diceTotal, state);
        if (rent > 0) {
          player.cash -= rent;
          owner.cash += rent;
          broadcastGameEvent(room, `💸 ${player.name} phải trả ${rent}$ tiền thuê cho ${owner.name} tại [${space.name}]!`, '#ef4444', 'Tiền Thuê');
        }
        state.turnPhase = 'ACTION_DECISION';
        state.actionTimeLeft = 6;
        state.activeCardModal = {
          spaceId,
          canAct: false,
          forcedByLanding: true,
        };
        broadcastState(room);
        handleBotTurn(room);
      }
      break;
    }

    case 'tax': {
      const tax = space.taxAmount || 100;
      player.cash -= tax;
      broadcastGameEvent(room, `🏛️ ${player.name} nộp thuế nhà nước ${tax}$!`, '#ef4444', 'Thuế');
      checkBankruptcy(room, player);
      endPlayerTurn(room);
      break;
    }

    case 'go_to_jail': {
      sendPlayerToJail(room, player);
      break;
    }

    case 'chance':
    case 'chest': {
      drawCard(room, player, space.type);
      break;
    }

    case 'go': {
      broadcastGameEvent(room, `🚩 ${player.name} đã dừng đúng ô Xuất Phát!`, '#10b981', 'Xuất Phát');
      endPlayerTurn(room);
      break;
    }
    case 'jail': {
      broadcastGameEvent(room, `👀 ${player.name} chỉ ghé Thăm Tù Nhân.`, '#64748b', 'Thăm Tù');
      endPlayerTurn(room);
      break;
    }
    case 'free_parking': {
      broadcastGameEvent(room, `☕ ${player.name} đang dừng chân nghỉ ngơi thư giãn.`, '#10b981', 'Nghỉ Chân');
      endPlayerTurn(room);
      break;
    }
    default: {
      endPlayerTurn(room);
      break;
    }
  }
}

function drawCard(room: RoomSession, player: Player, cardType: 'chance' | 'chest') {
  const state = room.state;
  const deck = cardType === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];
  state.drawnCard = card;

  const cardDesc = `🃏 [${cardType === 'chance' ? 'CƠ HỘI' : 'KHÍ VẬN'}] ${player.name} rút thẻ: "${card.title}" - ${card.description}`;
  state.history.unshift(cardDesc);
  broadcastToRoom(room, {
    type: 'CHAT_MESSAGE',
    message: {
      id: `card_${Date.now()}_${Math.random()}`,
      senderId: 'system',
      senderName: cardType === 'chance' ? 'Thẻ Cơ Hội' : 'Thẻ Khí Vận',
      senderColor: cardType === 'chance' ? '#ea580c' : '#2563eb',
      text: `${player.name} rút "${card.title}": ${card.description}`,
      timestamp: Date.now(),
    },
  });

  setTimeout(() => {
    switch (card.action) {
      case 'cash':
        if (card.amount) {
          player.cash += card.amount;
        }
        break;
      case 'move_to':
        if (card.targetSpace !== undefined) {
          player.position = card.targetSpace;
          if (card.targetSpace === 0) {
            player.cash += 200;
          }
        }
        break;
      case 'jail':
        sendPlayerToJail(room, player);
        return;
      case 'out_of_jail':
        player.getOutOfJailCards++;
        break;
      case 'repair':
        const houseCount = player.properties.reduce((sum, p) => sum + p.houses, 0);
        const cost = houseCount * (card.amount || 25);
        player.cash -= cost;
        break;
      case 'collect_from_all':
        const amount = card.amount || 20;
        for (const other of state.players) {
          if (other.id !== player.id && !other.isBankrupt) {
            other.cash -= amount;
            player.cash += amount;
          }
        }
        break;
    }

    state.drawnCard = null;
    checkBankruptcy(room, player);
    endPlayerTurn(room);
  }, 2500);

  broadcastState(room);
}

function buyProperty(room: RoomSession, playerId: string, spaceId: number) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  const space = MONOPOLY_SPACES[spaceId];
  if (!player || !space || !space.price) return;

  const alreadyOwned = state.players.some(p => p.properties.some(pr => pr.spaceId === spaceId));
  if (alreadyOwned || player.cash < space.price) return;

  player.cash -= space.price;
  player.properties.push({
    spaceId,
    houses: 0,
    isMortgaged: false,
  });

  broadcastGameEvent(room, `🏡 ${player.name} đã mua ô [${space.name}] với giá ${space.price}$!`, '#10b981', 'Mua Đất');
  state.activeCardModal = null;
  // Transition to MAIN_TURN and resume main turn countdown
  state.turnPhase = 'MAIN_TURN';
  state.currentTurnTimeLeft = state.mainTurnTimeLeft;
  state.turnTimerMax = state.mainTurnTimerMax;
  broadcastState(room);
  handleBotTurn(room);
}

function passAction(room: RoomSession, playerId: string) {
  const state = room.state;
  const currPlayer = state.players[state.currentPlayerIndex];
  if (!currPlayer || currPlayer.id !== playerId) return;

  const modal = state.activeCardModal;
  state.activeCardModal = null;

  // Requirement 5: If player landed on unowned property and didn't buy -> start auction!
  if (modal && modal.canAct && modal.forcedByLanding) {
    const space = MONOPOLY_SPACES[modal.spaceId];
    const isOwned = state.players.some(p => p.properties.some(pr => pr.spaceId === modal.spaceId));
    if (space && space.price && !isOwned) {
      broadcastGameEvent(room, `🏷️ ${currPlayer.name} quyết định KHÔNG mua [${space.name}]. Chuyển sang Đấu Giá!`, '#eab308', 'Đấu Giá');
      startAuction(room, modal.spaceId);
      return;
    }
  }

  // Otherwise, transition to MAIN_TURN and resume main turn countdown
  state.turnPhase = 'MAIN_TURN';
  state.currentTurnTimeLeft = state.mainTurnTimeLeft;
  state.turnTimerMax = state.mainTurnTimerMax;
  broadcastState(room);
  handleBotTurn(room);
}

// Auction Engine Functions
function startAuction(room: RoomSession, spaceId: number) {
  const state = room.state;
  const space = MONOPOLY_SPACES[spaceId];
  if (!space) {
    endPlayerTurn(room);
    return;
  }

  const eligiblePlayers = state.players.filter(p => !p.isBankrupt && !p.isDisconnected && !p.isQuit);
  if (eligiblePlayers.length === 0) {
    endPlayerTurn(room);
    return;
  }

  state.turnPhase = 'AUCTION';
  state.activeCardModal = null;
  state.auction = {
    spaceId,
    currentBid: 0,
    highestBidderId: null,
    highestBidderName: null,
    currentBidderId: eligiblePlayers[0].id,
    activeBidderIds: eligiblePlayers.map(p => p.id),
    timeLeft: 10,
    timeMax: 10,
  };

  broadcastGameEvent(room, `🔨 Bắt đầu phiên đấu giá [${space.name}] (Giá gốc: ${space.price}$)! Lượt chào giá của ${eligiblePlayers[0].name}.`, '#eab308', 'Đấu Giá');
  broadcastState(room);
  handleBotAuctionTurn(room);
}

function placeBid(room: RoomSession, playerId: string, amount: number) {
  const state = room.state;
  if (state.turnPhase !== 'AUCTION' || !state.auction) return;
  if (state.auction.currentBidderId !== playerId) return;

  const player = state.players.find(p => p.id === playerId);
  if (!player || player.cash < amount || amount <= state.auction.currentBid) return;

  state.auction.currentBid = amount;
  state.auction.highestBidderId = player.id;
  state.auction.highestBidderName = player.name;

  const space = MONOPOLY_SPACES[state.auction.spaceId];
  broadcastGameEvent(room, `💰 ${player.name} đặt giá ${amount}$ cho [${space?.name || 'khu đất'}]!`, '#eab308', 'Đấu Giá');

  advanceAuctionBidder(room);
}

function passBid(room: RoomSession, playerId: string) {
  const state = room.state;
  if (state.turnPhase !== 'AUCTION' || !state.auction) return;
  if (state.auction.currentBidderId !== playerId) return;

  const player = state.players.find(p => p.id === playerId);
  if (player) {
    broadcastGameEvent(room, `❌ ${player.name} đã bỏ qua không chào giá.`, '#64748b', 'Đấu Giá');
  }

  // Remove from active bidders
  state.auction.activeBidderIds = state.auction.activeBidderIds.filter(id => id !== playerId);

  const remaining = state.auction.activeBidderIds;
  if (remaining.length === 0 || (remaining.length === 1 && remaining[0] === state.auction.highestBidderId)) {
    finishAuction(room);
    return;
  }

  advanceAuctionBidder(room);
}

function advanceAuctionBidder(room: RoomSession) {
  const state = room.state;
  if (!state.auction) return;

  const remaining = state.auction.activeBidderIds;
  if (remaining.length === 0) {
    finishAuction(room);
    return;
  }

  const currIdx = remaining.indexOf(state.auction.currentBidderId);
  const nextIdx = (currIdx + 1) % remaining.length;
  state.auction.currentBidderId = remaining[nextIdx];
  state.auction.timeLeft = 10;

  broadcastState(room);
  handleBotAuctionTurn(room);
}

function finishAuction(room: RoomSession) {
  const state = room.state;
  if (!state.auction) return;

  const { spaceId, currentBid, highestBidderId } = state.auction;
  const space = MONOPOLY_SPACES[spaceId];

  if (highestBidderId && currentBid > 0) {
    const winner = state.players.find(p => p.id === highestBidderId);
    if (winner && space) {
      winner.cash -= currentBid;
      winner.properties.push({
        spaceId,
        houses: 0,
        isMortgaged: false,
      });
      broadcastGameEvent(room, `🏆 ${winner.name} đã thắng đấu giá [${space.name}] với giá ${currentBid}$!`, '#10b981', 'Đấu Giá');
    }
  } else {
    broadcastGameEvent(room, `⚠️ Không ai mua [${space?.name || 'khu đất'}] trong phiên đấu giá.`, '#64748b', 'Đấu Giá');
  }

  state.auction = null;
  state.turnPhase = 'RESOLVING';
  broadcastState(room);

  setTimeout(() => {
    endPlayerTurn(room);
  }, 1500);
}

function handleBotAuctionTurn(room: RoomSession) {
  const state = room.state;
  if (state.turnPhase !== 'AUCTION' || !state.auction) return;

  const currentBidder = state.players.find(p => p.id === state.auction?.currentBidderId);
  if (!currentBidder || !currentBidder.isBot || currentBidder.isBankrupt) return;

  clearTimeout(room.botTimeout);
  room.botTimeout = setTimeout(() => {
    if (!state.auction || state.auction.currentBidderId !== currentBidder.id) return;
    const space = MONOPOLY_SPACES[state.auction.spaceId];
    const minBid = state.auction.currentBid + 10;
    const maxBotBid = (space?.price || 200) * 0.85;

    if (minBid <= maxBotBid && currentBidder.cash >= minBid + 150) {
      placeBid(room, currentBidder.id, minBid);
    } else {
      passBid(room, currentBidder.id);
    }
  }, 1400);
}

function upgradeProperty(room: RoomSession, playerId: string, spaceId: number) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  const space = MONOPOLY_SPACES[spaceId];
  if (!player || !space || !space.houseCost) return;

  const prop = player.properties.find(p => p.spaceId === spaceId);
  if (!prop || prop.isMortgaged || prop.houses >= 5 || player.cash < space.houseCost) return;

  // Check monopoly
  const groupSpaces = COLOR_GROUPS[space.colorGroup] || [];
  const ownsAll = groupSpaces.every(sId => 
    player.properties.some(p => p.spaceId === sId && !p.isMortgaged)
  );
  if (!ownsAll) return;

  player.cash -= space.houseCost;
  prop.houses += 1;

  const typeName = prop.houses === 5 ? 'Khách sạn ⭐' : `Nhà cấp ${prop.houses} 🏠`;
  broadcastGameEvent(room, `🏗️ ${player.name} nâng cấp [${space.name}] lên ${typeName}!`, '#f59e0b', 'Xây Dựng');
  broadcastState(room);
}

function mortgageProperty(room: RoomSession, playerId: string, spaceId: number) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  const space = MONOPOLY_SPACES[spaceId];
  if (!player || !space || !space.mortgageValue) return;

  const prop = player.properties.find(p => p.spaceId === spaceId);
  if (!prop || prop.isMortgaged || prop.houses > 0) return;

  prop.isMortgaged = true;
  player.cash += space.mortgageValue;
  broadcastGameEvent(room, `📜 ${player.name} đã thế chấp [${space.name}] nhận ${space.mortgageValue}$.`, '#f97316', 'Cầm Cố');
  broadcastState(room);
}

function unmortgageProperty(room: RoomSession, playerId: string, spaceId: number) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  const space = MONOPOLY_SPACES[spaceId];
  if (!player || !space || !space.mortgageValue) return;

  const prop = player.properties.find(p => p.spaceId === spaceId);
  const cost = Math.round(space.mortgageValue * 1.1);
  if (!prop || !prop.isMortgaged || player.cash < cost) return;

  prop.isMortgaged = false;
  player.cash -= cost;
  broadcastGameEvent(room, `🔓 ${player.name} đã chuộc lại [${space.name}] với chi phí ${cost}$.`, '#10b981', 'Chuộc Đất');
  broadcastState(room);
}

function payJailFine(room: RoomSession, playerId: string) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  if (!player || !player.inJail || player.cash < 50) return;

  player.cash -= 50;
  player.inJail = false;
  player.jailTurns = 0;
  broadcastGameEvent(room, `💸 ${player.name} nộp phạt 50$ để rời khỏi tù.`, '#10b981', 'Ra Tù');
  broadcastState(room);
}

function useJailCard(room: RoomSession, playerId: string) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  if (!player || !player.inJail || player.getOutOfJailCards <= 0) return;

  player.getOutOfJailCards--;
  player.inJail = false;
  player.jailTurns = 0;
  broadcastGameEvent(room, `🎫 ${player.name} sử dụng Thẻ Ra Tù Miễn Phí.`, '#10b981', 'Ra Tù');
  broadcastState(room);
}

function checkBankruptcy(room: RoomSession, player: Player) {
  if (player.cash >= 0) return;

  // Net worth calculation
  const totalAssets = player.properties.reduce((sum, prop) => {
    const s = MONOPOLY_SPACES[prop.spaceId];
    return sum + (s?.mortgageValue || 0);
  }, player.cash);

  if (totalAssets < 0) {
    declareBankruptcy(room, player.id);
  }
}

function declareBankruptcy(room: RoomSession, playerId: string) {
  const state = room.state;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.isBankrupt) return;

  player.isBankrupt = true;
  player.properties = [];
  player.cash = 0;
  broadcastGameEvent(room, `💥 ${player.name} ĐÃ PHÁ SẢN VÀ RỜI KHỎI VÁN ĐẤU!`, '#dc2626', 'Phá Sản');

  // Check remaining active players (Requirement 1)
  if (checkRemainingActivePlayers(room)) return;

  endPlayerTurn(room);
}

function endPlayerTurn(room: RoomSession) {
  const state = room.state;

  // Check end conditions (rolls limit, time, cash target, single player remaining)
  if (checkGameEndConditions(room)) return;

  // If player rolled double and not in jail, they roll again!
  const curr = state.players[state.currentPlayerIndex];
  if (state.dice.isDouble && state.dice.rollCount > 0 && curr && !curr.inJail && !curr.isBankrupt && !curr.isDisconnected && !curr.isQuit) {
    state.turnPhase = 'ROLL_DICE';
    state.rollDiceTimeLeft = 8;
    state.rollDiceTimerMax = 8;
    state.mainTurnTimeLeft = state.mainTurnTimerMax;
    state.actionTimeLeft = 10;
    state.actionTimerMax = 10;
    state.currentTurnTimeLeft = 8;
    state.turnTimerMax = 8;
    state.activeCardModal = null;
    broadcastState(room);
    handleBotTurn(room);
    return;
  }

  // Next player: Skip bankrupt, disconnected, or quit players! (Requirement 1)
  state.dice.rollCount = 0;
  let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
  let loops = 0;
  while ((state.players[nextIdx]?.isBankrupt || state.players[nextIdx]?.isDisconnected || state.players[nextIdx]?.isQuit) && loops < state.players.length) {
    nextIdx = (nextIdx + 1) % state.players.length;
    loops++;
  }

  // Check if all players except one are dead/disconnected
  if (checkRemainingActivePlayers(room)) return;

  state.currentPlayerIndex = nextIdx;
  state.turnPhase = 'ROLL_DICE';
  state.rollDiceTimeLeft = 8;
  state.rollDiceTimerMax = 8;
  state.mainTurnTimeLeft = state.mainTurnTimerMax;
  state.actionTimeLeft = 10;
  state.actionTimerMax = 10;
  state.currentTurnTimeLeft = 8;
  state.turnTimerMax = 8;
  state.activeCardModal = null;

  const nextPlayer = state.players[nextIdx];
  if (nextPlayer) {
    broadcastGameEvent(room, `👉 Đến lượt của ${nextPlayer.name}!`, nextPlayer.color || '#3b82f6', 'Chuyển Lượt');
  }

  broadcastState(room);
  handleBotTurn(room);
}

// WebSocket handler
wss.on('connection', (ws: WebSocket) => {
  let boundRoomId: string | null = null;
  let boundPlayerId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const action = JSON.parse(data.toString()) as ClientAction;

      // Handle CREATE_ROOM (Requirement 4 & 6)
      if (action.type === 'CREATE_ROOM') {
        const roomId = (action.roomId || `VN${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();
        boundRoomId = roomId;
        const room = getOrCreateRoom(roomId);
        room.state.hostId = '';
        room.state.maxPlayers = Math.max(2, Math.min(10, action.maxPlayers || 4));
        const mainTimer = Math.max(15, Math.min(60, action.mainTurnTimer || 30));
        room.state.mainTurnTimerMax = mainTimer;
        room.state.mainTurnTimeLeft = mainTimer;
        room.state.startingCash = Math.max(500, Math.min(5000, action.startingCash || 1500));
        room.state.endRule = action.endRule || { type: 'max_rolls', value: 90 };
        room.state.totalRollsCount = 0;
        room.state.gameTimeElapsed = 0;
        room.state.gameStartTime = 0;
        room.state.leaderboard = [];

        const avatar = ROBLOX_AVATARS.find(a => a.id === action.avatarId) || ROBLOX_AVATARS[0];
        const assignedColor = DISTINCT_PLAYER_COLORS[0];
        const newPlayer: Player = {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: action.name || getRandomName(),
          avatar: { ...avatar, color: assignedColor },
          cash: room.state.startingCash,
          position: 0,
          inJail: false,
          jailTurns: 0,
          getOutOfJailCards: 0,
          isBankrupt: false,
          isDisconnected: false,
          isQuit: false,
          isBot: false,
          isReady: true, // Host is ready by default
          properties: [],
          color: assignedColor,
        };

        room.state.players = [newPlayer];
        room.state.hostId = newPlayer.id;
        boundPlayerId = newPlayer.id;
        room.clients.set(newPlayer.id, ws);

        broadcastGameEvent(
          room, 
          `👑 ${newPlayer.name} đã tạo phòng #${roomId} (Cần đủ ${room.state.maxPlayers} người, ${mainTimer}s/lượt, vốn ${room.state.startingCash}$).`,
          '#10b981',
          'Tạo Phòng'
        );
        broadcastState(room);
        return;
      }

      // Handle JOIN_ROOM (Requirement 6)
      if (action.type === 'JOIN_ROOM') {
        const roomId = (action.roomId || '').trim().toUpperCase();
        boundRoomId = roomId;
        let room = rooms.get(roomId);
        if (!room) {
          room = getOrCreateRoom(roomId);
        }

        if (room.state.status !== 'lobby') {
          // Check if reconnecting existing player
          const existing = room.state.players.find(p => p.name === action.name && (p.isDisconnected || p.isQuit));
          if (existing) {
            existing.isDisconnected = false;
            existing.isQuit = false;
            boundPlayerId = existing.id;
            room.clients.set(existing.id, ws);
            broadcastGameEvent(room, `🔌 ${existing.name} đã kết nối lại bàn cờ.`, '#3b82f6', 'Kết Nối');
            broadcastState(room);
            return;
          }

          ws.send(JSON.stringify({ type: 'ERROR', message: 'Ván đấu trong phòng này đã bắt đầu!' }));
          return;
        }

        if (room.state.players.length >= room.state.maxPlayers) {
          ws.send(JSON.stringify({ type: 'ERROR', message: `Phòng đã đủ ${room.state.maxPlayers} người chơi!` }));
          return;
        }

        const avatar = ROBLOX_AVATARS.find(a => a.id === action.avatarId) || ROBLOX_AVATARS[room.state.players.length % ROBLOX_AVATARS.length];
        const assignedColor = getPlayerUniqueColor(room.state.players);
        const newPlayer: Player = {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: action.name || getRandomName(),
          avatar: { ...avatar, color: assignedColor },
          cash: room.state.startingCash || 1500,
          position: 0,
          inJail: false,
          jailTurns: 0,
          getOutOfJailCards: 0,
          isBankrupt: false,
          isDisconnected: false,
          isQuit: false,
          isBot: false,
          isReady: false, // Guests start not ready
          properties: [],
          color: assignedColor,
        };

        if (!room.state.hostId) {
          room.state.hostId = newPlayer.id;
          newPlayer.isReady = true;
        }

        room.state.players.push(newPlayer);
        boundPlayerId = newPlayer.id;
        room.clients.set(newPlayer.id, ws);

        broadcastGameEvent(room, `👋 ${newPlayer.name} đã vào phòng (${room.state.players.length}/${room.state.maxPlayers}).`, '#3b82f6', 'Tham Gia');
        broadcastState(room);
        return;
      }

      if (!boundRoomId || !boundPlayerId) return;
      const room = rooms.get(boundRoomId);
      if (!room) return;

      switch (action.type) {
        // Toggle Ready (Requirement 6)
        case 'TOGGLE_READY': {
          const p = room.state.players.find(pl => pl.id === boundPlayerId);
          if (p && room.state.status === 'lobby') {
            p.isReady = !p.isReady;
            broadcastGameEvent(
              room,
              p.isReady ? `✅ ${p.name} đã SẴN SÀNG!` : `⏳ ${p.name} đã HỦY sẵn sàng!`,
              p.isReady ? '#10b981' : '#f59e0b',
              'Sẵn Sàng'
            );
            broadcastState(room);
          }
          break;
        }

        // Host start game check (Requirement 4 & 6)
        case 'START_GAME': {
          if (boundPlayerId !== room.state.hostId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Chỉ có Chủ Phòng mới có quyền bắt đầu trò chơi!' }));
            return;
          }
          if (room.state.players.length !== room.state.maxPlayers) {
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: `Cần đủ đúng ${room.state.maxPlayers} người chơi (hiện có ${room.state.players.length}). Hãy thêm người hoặc bot!` 
            }));
            return;
          }
          const allGuestsReady = room.state.players
            .filter(p => p.id !== room.state.hostId && !p.isBot)
            .every(p => p.isReady);
          if (!allGuestsReady) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Tất cả người chơi phải bấm Sẵn Sàng trước khi bắt đầu!' }));
            return;
          }

          room.state.status = 'playing';
          room.state.currentPlayerIndex = 0;
          room.state.turnPhase = 'ROLL_DICE';
          room.state.rollDiceTimeLeft = 8;
          room.state.currentTurnTimeLeft = 8;
          room.state.mainTurnTimeLeft = room.state.mainTurnTimerMax;
          room.state.gameStartTime = Date.now();
          room.state.totalRollsCount = 0;
          room.state.gameTimeElapsed = 0;
          broadcastGameEvent(room, '🎉 Tất cả người chơi đã sẵn sàng! Ván Cờ Tỷ Phú CHÍNH THỨC BẮT ĐẦU!', '#10b981', 'Bắt Đầu');
          startRoomTimer(room);
          broadcastState(room);
          handleBotTurn(room);
          break;
        }

        // Host Kick Player (Requirement 7)
        case 'KICK_PLAYER': {
          if (boundPlayerId !== room.state.hostId) return;
          const targetPlayerId = action.playerId;
          if (targetPlayerId === room.state.hostId) return;

          const targetPlayer = room.state.players.find(p => p.id === targetPlayerId);
          if (!targetPlayer) return;

          broadcastGameEvent(room, `👢 ${targetPlayer.name} đã bị chủ phòng KICK khỏi phòng!`, '#dc2626', 'Kick');

          const targetSocket = room.clients.get(targetPlayerId);
          if (targetSocket) {
            try {
              targetSocket.send(JSON.stringify({
                type: 'KICKED',
                message: 'Bạn đã bị chủ phòng kick khỏi phòng chơi!',
              }));
              targetSocket.close();
            } catch {
              // Ignore socket send errors
            }
            room.clients.delete(targetPlayerId);
          }

          if (room.state.status === 'lobby') {
            room.state.players = room.state.players.filter(p => p.id !== targetPlayerId);
          } else {
            targetPlayer.isDisconnected = true;
            targetPlayer.isQuit = true;
            targetPlayer.isBankrupt = true;
            if (!checkRemainingActivePlayers(room)) {
              const curr = room.state.players[room.state.currentPlayerIndex];
              if (curr && curr.id === targetPlayerId) {
                endPlayerTurn(room);
              }
            }
          }
          broadcastState(room);
          break;
        }

        // Quit Game voluntarily (Requirement 1)
        case 'QUIT_GAME': {
          const player = room.state.players.find(p => p.id === boundPlayerId);
          if (player) {
            broadcastGameEvent(room, `🔌 ${player.name} đã thoát khỏi cuộc chơi.`, '#64748b', 'Rời Game');
            if (room.state.status === 'lobby') {
              room.state.players = room.state.players.filter(p => p.id !== boundPlayerId);
              if (room.state.hostId === boundPlayerId && room.state.players.length > 0) {
                room.state.hostId = room.state.players[0].id;
                room.state.players[0].isReady = true;
              }
            } else {
              player.isDisconnected = true;
              player.isQuit = true;
              player.isBankrupt = true;
              if (!checkRemainingActivePlayers(room)) {
                const curr = room.state.players[room.state.currentPlayerIndex];
                if (curr && curr.id === boundPlayerId) {
                  endPlayerTurn(room);
                }
              }
            }
            const s = room.clients.get(boundPlayerId);
            if (s) {
              s.close();
              room.clients.delete(boundPlayerId);
            }
            broadcastState(room);
          }
          break;
        }

        case 'ADD_BOT': {
          if (room.state.players.length >= room.state.maxPlayers || room.state.status !== 'lobby') return;
          const botIdx = room.state.players.length;
          const avatar = ROBLOX_AVATARS[botIdx % ROBLOX_AVATARS.length];
          const botColor = getPlayerUniqueColor(room.state.players);
          const botPlayer: Player = {
            id: `bot_${Date.now()}_${botIdx}`,
            name: `Bot ${getRandomName()}`,
            avatar: { ...avatar, color: botColor },
            cash: room.state.startingCash || 1500,
            position: 0,
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            isBankrupt: false,
            isDisconnected: false,
            isQuit: false,
            isBot: true,
            isReady: true,
            properties: [],
            color: botColor,
          };
          room.state.players.push(botPlayer);
          broadcastGameEvent(room, `🤖 Đã thêm Bot: ${botPlayer.name} (${room.state.players.length}/${room.state.maxPlayers})`, '#eab308', 'Thêm Bot');
          broadcastState(room);
          break;
        }

        case 'REMOVE_PLAYER': {
          if (room.state.status === 'lobby') {
            room.state.players = room.state.players.filter(p => p.id !== action.playerId);
            broadcastState(room);
          }
          break;
        }

        case 'ROLL_DICE': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            rollDice(room, boundPlayerId);
          }
          break;
        }

        case 'BUY_PROPERTY': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            buyProperty(room, boundPlayerId, action.spaceId);
          }
          break;
        }

        case 'PASS_ACTION':
        case 'PASS_PROPERTY': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            passAction(room, boundPlayerId);
          }
          break;
        }

        case 'BID': {
          placeBid(room, boundPlayerId, action.amount);
          break;
        }

        case 'PASS_BID': {
          passBid(room, boundPlayerId);
          break;
        }

        case 'END_TURN': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            broadcastGameEvent(room, `⏭️ ${currPlayer.name} đã chủ động kết thúc lượt.`, '#94a3b8', 'Hết Lượt');
            endPlayerTurn(room);
          }
          break;
        }

        case 'UPGRADE_PROPERTY': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            upgradeProperty(room, boundPlayerId, action.spaceId);
          }
          break;
        }

        case 'MORTGAGE_PROPERTY': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            mortgageProperty(room, boundPlayerId, action.spaceId);
          }
          break;
        }

        case 'UNMORTGAGE_PROPERTY': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            unmortgageProperty(room, boundPlayerId, action.spaceId);
          }
          break;
        }

        case 'PAY_JAIL_FINE': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            payJailFine(room, boundPlayerId);
          }
          break;
        }

        case 'USE_JAIL_CARD': {
          const currPlayer = room.state.players[room.state.currentPlayerIndex];
          if (currPlayer && currPlayer.id === boundPlayerId) {
            useJailCard(room, boundPlayerId);
          }
          break;
        }

        case 'DECLARE_BANKRUPTCY':
          declareBankruptcy(room, boundPlayerId);
          break;

        case 'SEND_CHAT': {
          const sender = room.state.players.find(p => p.id === boundPlayerId);
          if (sender && action.text.trim()) {
            const chatMsg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              senderId: sender.id,
              senderName: sender.name,
              senderColor: sender.color,
              text: action.text.trim().substring(0, 200),
              timestamp: Date.now(),
            };
            broadcastToRoom(room, { type: 'CHAT_MESSAGE', message: chatMsg });
          }
          break;
        }
      }
    } catch (e) {
      console.error('WS Message error:', e);
    }
  });

  // Client Disconnect Handling (Requirement 1)
  ws.on('close', () => {
    if (boundRoomId && boundPlayerId) {
      const room = rooms.get(boundRoomId);
      if (room) {
        room.clients.delete(boundPlayerId);
        const player = room.state.players.find(p => p.id === boundPlayerId);
        if (player) {
          if (room.state.status === 'lobby') {
            room.state.players = room.state.players.filter(p => p.id !== boundPlayerId);
            if (room.state.hostId === boundPlayerId && room.state.players.length > 0) {
              room.state.hostId = room.state.players[0].id;
              room.state.players[0].isReady = true;
            }
          } else {
            // In game: mark disconnected, strike name, turn black, skip turn
            player.isDisconnected = true;
            broadcastGameEvent(room, `🔌 ${player.name} đã mất kết nối với máy chủ.`, '#64748b', 'Mất Kết Nối');
            if (!checkRemainingActivePlayers(room)) {
              const curr = room.state.players[room.state.currentPlayerIndex];
              if (curr && curr.id === boundPlayerId) {
                endPlayerTurn(room);
              }
            }
          }
          broadcastState(room);
        }

        if (room.clients.size === 0) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          clearTimeout(room.botTimeout);
        }
      }
    }
  });
});

// Vite middlewares integration
async function setupVite() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
}

setupVite().then(() => {
  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Monopoly Vietnam server running on http://0.0.0.0:${PORT}`);
  });
});
