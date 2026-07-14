import axios from 'axios'
import type { OddsShock } from '../types'

export async function generateExplanation(shock: OddsShock): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return generateTemplateFallback(shock)
  }

  const systemPrompt = `You are a football commentator writing for fans watching the World Cup.

Write exactly ONE sentence explaining this odds movement.
Maximum 15 words.
Use plain football fan language.

NEVER use these words: implied probability, delta, basis points, percentage shift, statistical, variance, deviation.

ALWAYS use words like: odds, market, bookmakers, favourites, chances, likely, unlikely.

Examples of good output:
- "Bookmakers now think France will win after that red card."
- "The odds moved fast — Argentina are suddenly favourites."
- "Market reacted instantly to the goal, Morocco now huge underdogs."

One sentence only. No numbers. No percentages.`
  
  const userPrompt = `Match: ${shock.homeTeam} vs ${shock.awayTeam}
Affected Team: ${shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam}
Probability direction: ${shock.direction} (moved by ${Math.round(shock.delta * 100)}% in ${shock.windowSeconds} seconds)
Current Implied Probability: ${Math.round(shock.postProb * 100)}%
Previous Implied Probability: ${Math.round(shock.preProb * 100)}%
Triggering Event: ${shock.triggerEvent || 'in-game dynamics'}
Trigger Minute: ${shock.triggerMinute || 'unknown'}`

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    )

    const content = res.data?.choices?.[0]?.message?.content
    if (content) {
      return content.trim().replace(/^"|"$/g, '') // strip wrapping quotes
    }
  } catch (err) {
    console.error('Groq API call failed, falling back to template:', err)
  }

  return generateTemplateFallback(shock)
}

function generateTemplateFallback(shock: OddsShock): string {
  const team = shock.affectedTeam === 'home' ? shock.homeTeam : shock.awayTeam
  const directionText = shock.direction === 'up' ? 'rose sharply' : 'dropped sharply'
  const eventText = shock.triggerEvent 
    ? `following the ${shock.triggerEvent.replace('_', ' ')}`
    : 'due to live match momentum'
  
  return `The market reacted quickly as ${team}'s chances ${directionText} ${eventText}.`
}
