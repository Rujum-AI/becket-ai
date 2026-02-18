/**
 * content-pull.js
 * Reads en.js + he.js translation files and generates CONTENT.md
 * Usage: node scripts/content-pull.js
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EN_PATH = resolve(ROOT, 'src/lib/translations/en.js')
const HE_PATH = resolve(ROOT, 'src/lib/translations/he.js')
const OUT_PATH = resolve(ROOT, 'CONTENT.md')

// ── Parse a translation JS file into { entries, sections } ──
// entries: [{ type: 'section'|'comment'|'kv'|'blank', ... }]
function parseTranslationFile(filePath) {
  const text = readFileSync(filePath, 'utf-8')
  const lines = text.split('\n')
  const entries = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip opening/closing braces
    if (trimmed === 'export default {' || trimmed === '}') continue

    // Blank line
    if (trimmed === '') {
      entries.push({ type: 'blank' })
      continue
    }

    // Section comment: // === SECTION ===
    const sectionMatch = trimmed.match(/^\/\/\s*===\s*(.+?)\s*===\s*$/)
    if (sectionMatch) {
      entries.push({ type: 'section', label: sectionMatch[1].trim() })
      continue
    }

    // Sub-comment: // Some label
    const commentMatch = trimmed.match(/^\/\/\s*(.+)$/)
    if (commentMatch) {
      entries.push({ type: 'comment', label: commentMatch[1].trim() })
      continue
    }

    // Array value: key: ['a', 'b', ...]
    const arrayMatch = trimmed.match(/^(['"]?)([^'"]+)\1:\s*\[/)
    if (arrayMatch) {
      const key = arrayMatch[2]
      // Collect the full array (may span one line)
      const arrayContent = trimmed.match(/\[(.+)\]/)
      if (arrayContent) {
        const items = arrayContent[1].match(/'([^']*)'/g)?.map(s => s.slice(1, -1)) || []
        entries.push({ type: 'array', key, values: items })
      }
      continue
    }

    // Key-value: key: 'value' or key: "value" or 'key with spaces': 'value'
    // Handle escaped quotes in values
    const kvMatch = trimmed.match(/^(['"]?)([^'"]*?)\1:\s*(['"])(.*)\3,?\s*$/)
    if (kvMatch) {
      const key = kvMatch[2]
      let value = kvMatch[4]
      // Unescape
      value = value.replace(/\\'/g, "'").replace(/\\"/g, '"')
      entries.push({ type: 'kv', key, value })
      continue
    }

    // Fallback for tricky values (multi-quote, template literals)
    // Try a more lenient match: key: 'anything',
    const lenientMatch = trimmed.match(/^(['"]?)([^'"]*?)\1:\s*['"](.*)['"],?\s*$/)
    if (lenientMatch) {
      const key = lenientMatch[2]
      let value = lenientMatch[3]
      value = value.replace(/\\'/g, "'").replace(/\\"/g, '"')
      entries.push({ type: 'kv', key, value })
      continue
    }
  }

  return entries
}

// ── Build a key→value map from entries ──
function buildMap(entries) {
  const map = {}
  for (const e of entries) {
    if (e.type === 'kv') map[e.key] = e.value
    if (e.type === 'array') map[e.key] = e.values
  }
  return map
}

// ── Generate Markdown ──
function generateMarkdown(enEntries, heMap) {
  const lines = []
  lines.push('# Becket AI - Content Editor')
  lines.push('')
  lines.push('> Edit EN/HE values below. Run `npm run content:push` to sync back to code.')
  lines.push('> Do NOT change `**key**` names or section headers.')
  lines.push('')

  for (const entry of enEntries) {
    switch (entry.type) {
      case 'section':
        lines.push(`---`)
        lines.push('')
        lines.push(`## ${entry.label}`)
        lines.push('')
        break

      case 'comment':
        lines.push(`### ${entry.label}`)
        lines.push('')
        break

      case 'blank':
        // skip extra blanks
        break

      case 'kv': {
        const heVal = heMap[entry.key] ?? ''
        lines.push(`**${entry.key}**`)
        lines.push(`- EN: ${entry.value}`)
        lines.push(`- HE: ${heVal}`)
        lines.push('')
        break
      }

      case 'array': {
        const heArr = heMap[entry.key] || []
        lines.push(`**${entry.key}** _(array)_`)
        lines.push(`- EN: ${entry.values.join(' | ')}`)
        lines.push(`- HE: ${(Array.isArray(heArr) ? heArr : []).join(' | ')}`)
        lines.push('')
        break
      }
    }
  }

  // Check for HE keys missing in EN
  const enMap = buildMap(enEntries)
  const missingInEn = Object.keys(heMap).filter(k => !(k in enMap))
  if (missingInEn.length > 0) {
    lines.push(`---`)
    lines.push('')
    lines.push(`## KEYS ONLY IN HEBREW (missing from en.js)`)
    lines.push('')
    for (const key of missingInEn) {
      const val = heMap[key]
      lines.push(`**${key}**`)
      lines.push(`- EN: `)
      lines.push(`- HE: ${Array.isArray(val) ? val.join(' | ') : val}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ── Main ──
const enEntries = parseTranslationFile(EN_PATH)
const heEntries = parseTranslationFile(HE_PATH)
const heMap = buildMap(heEntries)

const md = generateMarkdown(enEntries, heMap)
writeFileSync(OUT_PATH, md, 'utf-8')

const enMap = buildMap(enEntries)
const enCount = Object.keys(enMap).length
const heCount = Object.keys(heMap).length
console.log(`Generated CONTENT.md`)
console.log(`  EN keys: ${enCount}`)
console.log(`  HE keys: ${heCount}`)
if (enCount !== heCount) {
  const missingHe = Object.keys(enMap).filter(k => !(k in heMap))
  const missingEn = Object.keys(heMap).filter(k => !(k in enMap))
  if (missingHe.length) console.log(`  Missing in HE: ${missingHe.join(', ')}`)
  if (missingEn.length) console.log(`  Missing in EN: ${missingEn.join(', ')}`)
}
