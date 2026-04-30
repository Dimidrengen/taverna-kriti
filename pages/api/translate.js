// pages/api/translate.js
// Server-side DeepL translation endpoint.
// API key is read from process.env.DEEPL_API_KEY (set in .env.local + Vercel).

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DEEPL_TARGET_MAP = {
  en: 'EN-US', da: 'DA', de: 'DE', el: 'EL',
  fr: 'FR', sv: 'SV', no: 'NB', fi: 'FI',
}
const DEEPL_SOURCE_MAP = {
  en: 'EN', da: 'DA', de: 'DE', el: 'EL',
  fr: 'FR', sv: 'SV', no: 'NB', fi: 'FI',
}
const ALL_LANGS = ['en', 'da', 'de', 'el', 'fr', 'sv', 'no', 'fi']

async function deeplTranslate(texts, sourceLang, targetLang) {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) throw new Error('DEEPL_API_KEY not configured')

  const isFree = apiKey.endsWith(':fx')
  const baseUrl = isFree ? 'https://api-free.deepl.com' : 'https://api.deepl.com'

  const filtered = texts.map(t => (t || '').trim())
  if (filtered.every(t => !t)) return filtered

  const params = new URLSearchParams()
  params.append('auth_key', apiKey)
  params.append('source_lang', DEEPL_SOURCE_MAP[sourceLang] || 'EN')
  params.append('target_lang', DEEPL_TARGET_MAP[targetLang] || 'EN-US')
  params.append('preserve_formatting', '1')
  filtered.forEach(t => params.append('text', t || '_'))

  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`DeepL ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data.translations.map((t, i) => filtered[i] ? t.text : '')
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

  const slugMatch = user.email.match(/^admin@(.+)\.com$/i)
  const slug = slugMatch ? slugMatch[1] : null
  if (!slug) return res.status(403).json({ success: false, error: 'Invalid admin' })

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants').select('id, source_language').eq('slug', slug).single()
  if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

  try {
    const { itemId, name, description, targetLangs, save } = req.body || {}
    if (!itemId) return res.status(400).json({ success: false, error: 'Missing itemId' })

    const { data: item } = await supabaseAdmin
      .from('menu_items').select('id, restaurant_id, name, description')
      .eq('id', itemId).single()
    if (!item || item.restaurant_id !== restaurant.id) {
      return res.status(403).json({ success: false, error: 'Item not in your restaurant' })
    }

    const sourceLang = restaurant.source_language || 'en'
    const sourceName = (name ?? item.name) || ''
    const sourceDesc = (description ?? item.description) || ''

    const targets = (targetLangs && Array.isArray(targetLangs) && targetLangs.length)
      ? targetLangs.filter(l => ALL_LANGS.includes(l) && l !== sourceLang)
      : ALL_LANGS.filter(l => l !== sourceLang)

    const results = {}
    for (const target of targets) {
      try {
        const [tName, tDesc] = await deeplTranslate(
          [sourceName, sourceDesc], sourceLang, target
        )
        results[target] = { name: tName, description: tDesc }
      } catch (err) {
        console.error(`Translation to ${target} failed:`, err.message)
        results[target] = { name: '', description: '', error: err.message }
      }
    }

    if (save) {
      for (const [lang, t] of Object.entries(results)) {
        if (t.error) continue
        await supabaseAdmin.from('menu_item_translations').upsert({
          item_id: itemId,
          lang,
          name: t.name,
          description: t.description,
        }, { onConflict: 'item_id,lang' })
      }
    }

    return res.status(200).json({ success: true, sourceLang, translations: results })
  } catch (err) {
    console.error('translate error:', err)
    return res.status(500).json({ success: false, error: err.message || 'Translation failed' })
  }
}