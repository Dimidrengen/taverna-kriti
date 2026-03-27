import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGS = ['en', 'da', 'de', 'fr', 'el', 'sv', 'no', 'fi']

const LANG_NAMES = {
  en: 'English', da: 'Danish', de: 'German',
  fr: 'French', el: 'Greek', sv: 'Swedish',
  no: 'Norwegian', fi: 'Finnish'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { itemId, name, description } = req.body

  if (!itemId || !name) return res.status(400).json({ error: 'Missing itemId or name' })

  try {
    const prompt = `You are a restaurant menu translator. Translate the following menu item into these languages: ${LANGS.map(l => LANG_NAMES[l]).join(', ')}.

Item name: ${name}
Description: ${description || ''}

Respond ONLY with a JSON object like this, no other text:
{
  "en": { "name": "...", "description": "..." },
  "da": { "name": "...", "description": "..." },
  "de": { "name": "...", "description": "..." },
  "fr": { "name": "...", "description": "..." },
  "el": { "name": "...", "description": "..." },
  "sv": { "name": "...", "description": "..." },
  "no": { "name": "...", "description": "..." },
  "fi": { "name": "...", "description": "..." }
}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = message.content[0].text.trim()
    const translations = JSON.parse(text)

    // Gem i databasen
    const rows = LANGS.map(lang => ({
      item_id: itemId,
      lang,
      name: translations[lang]?.name || name,
      description: translations[lang]?.description || description || ''
    }))

    await supabase
      .from('menu_item_translations')
      .upsert(rows, { onConflict: 'item_id,lang' })

    res.status(200).json({ success: true, translations })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Translation failed' })
  }
}