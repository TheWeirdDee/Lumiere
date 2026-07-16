import type { OddsEvent } from './txline/types'

/** The single full-match 1X2 market shown by LUMIERE's win-chances UI. */
export const PRIMARY_MARKET = '1X2_PARTICIPANT_RESULT'

/** Excludes first-half and extra-time markets from the full-match probability feed. */
export function isPrimaryMarket(event: OddsEvent): boolean {
  return event.market === PRIMARY_MARKET
}
