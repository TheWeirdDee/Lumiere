import type { MatchEvent, MatchState, OddsEvent } from '../lib/txline/types'

export type { MatchEvent, MatchState, OddsEvent }

export interface OddsShock {
  id?: string
  matchId: string
  homeTeam: string
  awayTeam: string
  affectedTeam: 'home' | 'away'
  direction: 'up' | 'down'
  delta: number           // e.g. 0.18 = 18%
  windowSeconds: number   // how fast it moved
  preProb: number         // probability before shock
  postProb: number         // probability after shock
  triggerEvent?: string   // 'goal' | 'red_card' | 'penalty' | null
  triggerMinute?: number
  explanation?: string    // AI-generated
  firedAt: number         // unix timestamp
}

export type MarketCallChoice = 'follow' | 'fade'
export type MarketCallStatus = 'pending' | 'won' | 'lost' | 'push'

export interface MarketCall {
  id: string
  shockId: string
  matchId: string
  userId?: string
  choice: MarketCallChoice
  affectedTeam: 'home' | 'away'
  preProb: number
  postProb: number
  targetEventAt: number
  resolvedProb?: number
  retention?: number
  status: MarketCallStatus
  iqDelta: number
  verified: boolean
  createdAt: number
  resolvedAt?: number
}

// ---------------------------------------------------------------------------
// Betting codes
// ---------------------------------------------------------------------------

export type SelectionType = 'home_win' | 'away_win' | 'draw' | 'over_2.5' | 'under_2.5' | 'btts_yes' | 'btts_no'
export type Platform = 'sportybet' | 'bet9ja' | '1xbet' | '247bet' | 'other'
export type CodeStatus = 'pending' | 'active' | 'won' | 'lost' | 'partial' | 'void'
export type SelectionStatus = 'pending' | 'won' | 'lost' | 'void'

export interface Selection {
  id?: string
  matchId: string
  homeTeam: string
  awayTeam: string
  selectionType: SelectionType
  platformOdds: number
  txlineProb: number
  platformProb: number
  edge: number
  edgeVerified?: boolean
  fromShock: boolean
  shockId?: string
  status: SelectionStatus
  matchResult?: string
}

export interface BettingCode {
  id?: string
  creatorId: string
  creatorUsername: string
  platform: Platform
  platformCode?: string
  lumiereCode: string
  selections: Selection[]
  overallEdge: number
  status: CodeStatus
  shareCount: number
  viewCount: number
  createdAt: number
  resolvedAt?: number
}

export interface LumiereUser {
  id: string
  username: string
  telegramId?: string
  marketIQ: number
  totalCodes: number
  winningCodes: number
}
