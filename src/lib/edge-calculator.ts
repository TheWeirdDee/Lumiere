export function calculateEdge(txlineProb: number, platformOdds: number): number {
  // txlineProb: 0-1 (e.g. 0.65 = 65%). platformOdds: decimal (e.g. 2.10).
  const platformProb = 1 / platformOdds
  return Number((txlineProb - platformProb).toFixed(4))
  // Positive = you have market edge. Negative = bookmaker has edge over you.
}

export function calculateCodeEdge(selections: Array<{ edge: number }>): number {
  if (selections.length === 0) return 0
  const avg = selections.reduce((sum, s) => sum + s.edge, 0) / selections.length
  return Number(avg.toFixed(4))
}

export function formatEdge(edge: number): string {
  const pct = (edge * 100).toFixed(1)
  return edge >= 0 ? `+${pct}%` : `${pct}%`
}

export function edgeLabel(edge: number): 'strong' | 'marginal' | 'negative' {
  if (edge >= 0.05) return 'strong'
  if (edge >= 0) return 'marginal'
  return 'negative'
}
