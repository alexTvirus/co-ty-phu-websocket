export type SpaceType = 
  | 'property' 
  | 'railroad' 
  | 'utility' 
  | 'go' 
  | 'jail' 
  | 'free_parking' 
  | 'go_to_jail' 
  | 'chance' 
  | 'chest' 
  | 'tax';

export type ColorGroup = 
  | 'brown' 
  | 'lightblue' 
  | 'pink' 
  | 'orange' 
  | 'red' 
  | 'yellow' 
  | 'green' 
  | 'darkblue' 
  | 'station' 
  | 'utility' 
  | 'special';

export interface SpaceData {
  id: number;
  name: string;
  type: SpaceType;
  colorGroup: ColorGroup;
  price?: number;
  rent?: number[]; // [base, monopoly, 1 house, 2 houses, 3 houses, 4 houses, hotel]
  houseCost?: number;
  mortgageValue?: number;
  taxAmount?: number;
  icon: string;
  colorHex: string;
  subName?: string;
}

export interface PlayerPropertyState {
  spaceId: number;
  houses: number; // 0 = empty, 1-4 = houses, 5 = hotel
  isMortgaged: boolean;
}

export interface TokenAvatar {
  id: string;
  name: string;
  hat: string; // emoji or icon
  color: string;
  accentColor: string;
  face: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: TokenAvatar;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  isDisconnected?: boolean;
  isQuit?: boolean;
  isBot: boolean;
  isReady: boolean;
  properties: PlayerPropertyState[];
  color: string;
}

export interface Card {
  id: string;
  type: 'chance' | 'chest';
  title: string;
  description: string;
  action: 'cash' | 'move_to' | 'move_steps' | 'jail' | 'out_of_jail' | 'repair' | 'collect_from_all';
  amount?: number;
  targetSpace?: number;
}

export type TurnPhase = 
  | 'WAITING_TO_START'
  | 'ROLL_DICE'       // initial dice roll countdown (auto-roll if expires)
  | 'MOVING'          // moving animation
  | 'ACTION_DECISION' // model card open, main turn paused!
  | 'MAIN_TURN'       // main player turn countdown (resumes after card closes)
  | 'AUCTION'         // bidding between players
  | 'RESOLVING'
  | 'TURN_ENDED'
  | 'GAME_OVER';

export interface AuctionState {
  spaceId: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  currentBidderId: string;
  activeBidderIds: string[]; // IDs of players who haven't passed
  timeLeft: number;
  timeMax: number;
}

export interface DiceState {
  die1: number;
  die2: number;
  isRolling: boolean;
  isDouble: boolean;
  rollCount: number; // doubles in a row
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type EndRuleType = 'max_rolls' | 'time_limit' | 'target_cash' | 'bankruptcy';

export interface GameEndRule {
  type: EndRuleType;
  value: number; // e.g. 90 (rolls), 15 (minutes), 4000 ($), 0 (bankruptcy)
}

export interface PlayerNetWorth {
  playerId: string;
  name: string;
  color: string;
  cash: number;
  propertyValue: number;
  houseValue: number;
  totalNetWorth: number;
  rank: number;
}

export interface GameState {
  roomId: string;
  hostId: string;
  maxPlayers: number;
  startingCash: number;
  status: 'lobby' | 'playing' | 'ended';
  players: Player[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  dice: DiceState;
  currentTurnTimeLeft: number; // dynamically reflects current phase countdown
  turnTimerMax: number;
  rollDiceTimeLeft: number;    // separate roll countdown (default 8s)
  rollDiceTimerMax: number;
  mainTurnTimeLeft: number;    // separate main turn countdown (default 30s)
  mainTurnTimerMax: number;
  actionTimeLeft: number;      // separate model card countdown (default 10s)
  actionTimerMax: number;
  activeCardModal: {
    spaceId: number;
    canAct: boolean;
    forcedByLanding: boolean;
  } | null;
  auction: AuctionState | null;
  drawnCard: Card | null;
  winnerId: string | null;
  history: string[];
  endRule?: GameEndRule;
  totalRollsCount: number;
  gameStartTime?: number;
  gameTimeElapsed?: number; // seconds elapsed
  endReason?: string;
  leaderboard?: PlayerNetWorth[];
}

export interface TradeOffer {
  fromPlayerId: string;
  toPlayerId: string;
  offeredCash: number;
  offeredProperties: number[];
  requestedCash: number;
  requestedProperties: number[];
}

export type ClientAction =
  | { 
      type: 'CREATE_ROOM'; 
      roomId?: string; 
      name: string; 
      avatarId: string; 
      maxPlayers: number; 
      mainTurnTimer: number; 
      startingCash: number;
      endRule?: GameEndRule;
    }
  | { type: 'JOIN_ROOM'; roomId: string; name: string; avatarId: string }
  | { type: 'TOGGLE_READY' }
  | { type: 'START_GAME' }
  | { type: 'ADD_BOT' }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'KICK_PLAYER'; playerId: string }
  | { type: 'QUIT_GAME' }
  | { type: 'ROLL_DICE' }
  | { type: 'BUY_PROPERTY'; spaceId: number }
  | { type: 'PASS_ACTION' }
  | { type: 'PASS_PROPERTY'; spaceId: number }
  | { type: 'BID'; amount: number }
  | { type: 'PASS_BID' }
  | { type: 'UPGRADE_PROPERTY'; spaceId: number }
  | { type: 'MORTGAGE_PROPERTY'; spaceId: number }
  | { type: 'UNMORTGAGE_PROPERTY'; spaceId: number }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'END_TURN' }
  | { type: 'DECLARE_BANKRUPTCY' }
  | { type: 'SEND_CHAT'; text: string };

export type ServerMessage =
  | { type: 'ROOM_STATE'; state: GameState; yourPlayerId: string }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'PLAYER_MOVED'; playerId: string; from: number; to: number; path: number[] }
  | { type: 'NOTIFICATION'; text: string; level?: 'info' | 'success' | 'warning' | 'danger' }
  | { type: 'KICKED'; message: string }
  | { type: 'ERROR'; message: string };
