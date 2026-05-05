// pages/api/parse-menu-pdf.js
// Parses a menu PDF using Anthropic Claude API and returns structured items.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },  // PDFs can be big
  },
}

// Auto-emoji mapping based on keywords in dish name
function pickEmoji(name, category) {
  const lower = (name || '').toLowerCase()
  // Specific items first
  const specific = [
    [/dolma|stuffed.*vine|γεμιστά/, '🫒'],
    [/tzatziki|yogurt/, '🥒'],
    [/feta|cheese|tyri|τυρ|ost/, '🧀'],
    [/olive|elia|ελιά/, '🫒'],
    [/bread|brød|ψωμί/, '🥖'],
    [/pita|πίτα/, '🫓'],
    [/falafel/, '🧆'],
    [/hummus|χούμους/, '🧆'],
    [/wrap|gyro|γύρο|souvlaki|σουβλάκι/, '🥙'],
    [/burrito|taco/, '🌯'],
    [/burger/, '🍔'],
    [/pizza/, '🍕'],
    [/pasta|spaghetti|carbonara|bolognese|lasagne/, '🍝'],
    [/noodle|ramen|udon/, '🍜'],
    [/sushi|maki/, '🍣'],
    [/dumpling|gyoza/, '🥟'],
    [/salad|σαλάτα|salat/, '🥗'],
    [/tomat|tomato/, '🍅'],
    [/lemon|citron|λεμόνι/, '🍋'],
    [/avocado/, '🥑'],
    [/garlic|hvidløg|σκόρδο/, '🧄'],
    [/onion|løg|κρεμμύδι/, '🧅'],
    [/corn|majs|καλαμπόκι/, '🌽'],
    [/mushroom|champignon|μανιτάρι/, '🍄'],
    [/eggplant|aubergine|μελιτζάνα/, '🍆'],
    [/pepper|chili|peberfrugt/, '🌶️'],
    [/potato|kartoffel|πατάτα|fries|pommes/, '🍟'],
    [/rice|ris|ρύζι|pilaf/, '🍚'],
    [/egg|æg|αυγό|omelet|frittata/, '🍳'],
    [/chicken|kylling|κοτόπουλο/, '🍗'],
    [/pork|svin|χοιρινό|bacon/, '🥓'],
    [/beef|okse|βοδινό|steak|bøf/, '🥩'],
    [/lamb|lam|αρνί|αρνάκι/, '🐑'],
    [/fish|fisk|ψάρι|cod|salmon|laks/, '🐟'],
    [/shrimp|prawn|reje|γαρίδα/, '🦐'],
    [/lobster|hummer|αστακός/, '🦞'],
    [/crab|krabbe|καβούρι/, '🦀'],
    [/octopus|χταπόδι|blæksprutte/, '🐙'],
    [/squid|kalamari|καλαμάρι/, '🦑'],
    [/oyster|østers|στρείδι/, '🦪'],
    [/mussel|musling|μύδι/, '🐚'],
    [/sausage|pølse|λουκάνικο/, '🌭'],
    [/moussaka|μουσακάς|gratin|gryderet|stew|γιουβέτσι/, '🍲'],
    [/soup|suppe|σούπα/, '🍲'],
    [/cake|kage|τούρτα/, '🍰'],
    [/cheesecake/, '🍰'],
    [/icecream|ice cream|is|παγωτό|sorbet/, '🍦'],
    [/cookie|småkage|μπισκότο/, '🍪'],
    [/chocolate|chokolade|σοκολάτα/, '🍫'],
    [/donut/, '🍩'],
    [/honey|honning|μέλι/, '🍯'],
    [/croissant/, '🥐'],
    [/baklava|μπακλαβά/, '🥮'],
    [/yogurt|γιαούρτι/, '🍯'],
    [/strawberry|jordbær|φράουλα/, '🍓'],
    [/blueberry|blåbær/, '🫐'],
    [/peach|fersken|ροδάκινο/, '🍑'],
    [/grape|drue|σταφύλι/, '🍇'],
    [/apple|æble|μήλο/, '🍎'],
    [/banana|μπανάνα/, '🍌'],
    [/orange|appelsin|πορτοκάλι/, '🍊'],
    [/pineapple|ananas|ανανάς/, '🍍'],
    [/watermelon|vandmelon|καρπούζι/, '🍉'],
    [/coconut|kokos/, '🥥'],
    // Drinks
    [/beer|øl|μπύρα|pilsner|lager|ipa/, '🍺'],
    [/wine|vin|κρασί|sangria/, '🍷'],
    [/champagne|prosecco|cava/, '🍾'],
    [/cocktail|mojito|margarita|martini|negroni|spritz/, '🍸'],
    [/whisk|bourbon|cognac|brandy|rum|vodka|gin|tequila|ouzo|raki/, '🥃'],
    [/coffee|kaffe|καφές|espresso|latte|cappucc|americano|frappe/, '☕'],
    [/tea|te|τσάι|matcha/, '🍵'],
    [/water|vand|νερό/, '💧'],
    [/juice|saft|χυμός/, '🧃'],
    [/milk|mælk|γάλα/, '🥛'],
    [/smoothie|milkshake|shake/, '🥤'],
    [/lemonade|limonade|λεμονάδα/, '🍋'],
    [/soda|cola|sprite|fanta|seven up|7up/, '🥤'],
  ]
  for (const [pattern, emoji] of specific) {
    if (pattern.test(lower)) return emoji
  }
  // Fall back by category
  const catMap = {
    Starters: '🫒', Salads: '🥗', Mains: '🍖', Sides: '🍟', Desserts: '🍰', Drinks: '🥤',
  }
  return catMap[category] || '🍽'
}

// Guess station (kitchen vs bar)
function pickStation(category) {
  return category === 'Drinks' ? 'bar' : 'kitchen'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !user || !user.email?.startsWith('admin@')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Server misconfigured: ANTHROPIC_API_KEY environment variable is missing. Add it to Vercel and redeploy.',
    })
  }

  try {
    const { pdfBase64 } = req.body || {}
    if (!pdfBase64) {
      return res.status(400).json({ success: false, error: 'Missing pdfBase64' })
    }

    // Strip data URL prefix if present
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '')

    const prompt = `You are a menu data extraction assistant. Extract ALL menu items from this PDF and return them as a JSON array.

For each menu item, extract:
- "name": dish name (in original language as written)
- "description": short description if present, else empty string
- "price": numeric price in EUR (extract just the number, e.g. 12.50 — if multiple prices given, use the cheapest one. If no price visible, use 0)
- "category": MUST be exactly one of: "Starters", "Salads", "Mains", "Sides", "Desserts", "Drinks"

Rules:
- Skip section headers, intro text, footers, allergen notes, etc. — ONLY actual menu items with prices
- If a section is unclear which category, infer from context (cocktails/beer/wine → Drinks, salads → Salads, soups/stews/meat/fish → Mains, etc.)
- For drink-only menus, items go in "Drinks"
- Price must be a number, not a string. If you see "€12,50" or "12.50€" or "$12.50", extract 12.50.
- Output ONLY the JSON array, no markdown code blocks, no explanation, no preamble.
- Example output format:
[{"name":"Greek Salad","description":"Tomato, cucumber, feta, olives","price":8.50,"category":"Salads"},{"name":"Moussaka","description":"","price":12.00,"category":"Mains"}]`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: cleanBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => '(no body)')
      return res.status(500).json({
        success: false,
        error: `Claude API ${claudeRes.status}: ${errText.slice(0, 300)}`,
      })
    }

    const claudeData = await claudeRes.json()
    const textBlock = (claudeData.content || []).find(b => b.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ success: false, error: 'No text in Claude response' })
    }

    let raw = textBlock.text.trim()
    // Strip markdown code fences if Claude added them despite instructions
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    let items
    try {
      items = JSON.parse(raw)
    } catch (parseErr) {
      // Try to extract JSON array from text
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        try { items = JSON.parse(match[0]) } catch { items = null }
      }
      if (!items) {
        return res.status(500).json({
          success: false,
          error: 'Could not parse Claude response as JSON',
          rawResponse: raw.slice(0, 500),
        })
      }
    }

    if (!Array.isArray(items)) {
      return res.status(500).json({ success: false, error: 'Claude did not return an array' })
    }

    // Normalize, validate, add emoji + station
    const validCategories = ['Starters', 'Salads', 'Mains', 'Sides', 'Desserts', 'Drinks']
    const normalized = items
      .filter(i => i && typeof i === 'object' && i.name)
      .map(i => {
        const category = validCategories.includes(i.category) ? i.category : 'Mains'
        const price = typeof i.price === 'number' ? i.price : parseFloat(i.price) || 0
        return {
          name: String(i.name).trim().slice(0, 200),
          description: String(i.description || '').trim().slice(0, 1000),
          price: Math.max(0, price),
          category,
          emoji: pickEmoji(i.name, category),
          station: pickStation(category),
        }
      })

    return res.status(200).json({
      success: true,
      items: normalized,
      tokensUsed: claudeData.usage || null,
    })
  } catch (err) {
    console.error('parse-menu-pdf error:', err)
    return res.status(500).json({ success: false, error: err.message || 'Parsing failed' })
  }
}