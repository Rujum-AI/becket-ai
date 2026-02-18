/**
 * content-push.js
 * Reads CONTENT.md and writes back to en.js + he.js
 * Usage: node scripts/content-push.js
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EN_PATH = resolve(ROOT, 'src/lib/translations/en.js')
const HE_PATH = resolve(ROOT, 'src/lib/translations/he.js')
const MD_PATH = resolve(ROOT, 'CONTENT.md')

// ── Parse the original JS file to preserve structure (sections, comments, order) ──
function parseStructure(filePath) {
  const text = readFileSync(filePath, 'utf-8')
  const lines = text.split('\n')
  const structure = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '') // strip CR from CRLF
    const trimmed = line.trim()

    if (trimmed === 'export default {' || trimmed === '}') {
      structure.push({ type: 'wrapper', raw: line })
      continue
    }

    if (trimmed === '') {
      structure.push({ type: 'blank' })
      continue
    }

    const sectionMatch = trimmed.match(/^\/\/\s*===\s*(.+?)\s*===\s*$/)
    if (sectionMatch) {
      structure.push({ type: 'section', label: sectionMatch[1].trim(), raw: line })
      continue
    }

    const commentMatch = trimmed.match(/^\/\/\s*(.+)$/)
    if (commentMatch) {
      structure.push({ type: 'comment', label: commentMatch[1].trim(), raw: line })
      continue
    }

    // Array
    const arrayMatch = trimmed.match(/^(['"]?)([^'"]+)\1:\s*\[/)
    if (arrayMatch) {
      structure.push({ type: 'array', key: arrayMatch[2], keyQuote: arrayMatch[1], raw: line })
      continue
    }

    // KV
    const kvMatch = trimmed.match(/^(['"]?)([^'"]*?)\1:\s*(['"])(.*)\3,?\s*$/)
    if (kvMatch) {
      structure.push({ type: 'kv', key: kvMatch[2], keyQuote: kvMatch[1], valQuote: kvMatch[3], raw: line })
      continue
    }

    const lenientMatch = trimmed.match(/^(['"]?)([^'"]*?)\1:\s*['"](.*)['"],?\s*$/)
    if (lenientMatch) {
      structure.push({ type: 'kv', key: lenientMatch[2], keyQuote: lenientMatch[1], raw: line })
      continue
    }

    // Unknown line, preserve as-is
    structure.push({ type: 'unknown', raw: line })
  }

  return structure
}

// ── Parse CONTENT.md into { key: { en, he } } ──
function parseMd(mdPath) {
  const text = readFileSync(mdPath, 'utf-8')
  const lines = text.split('\n')
  const entries = {}
  let currentKey = null
  let isArray = false

  for (const line of lines) {
    // Key header: **keyName** or **keyName** _(array)_
    const keyMatch = line.match(/^\*\*([^*]+)\*\*\s*(?:_\(array\)_)?/)
    if (keyMatch) {
      currentKey = keyMatch[1].trim()
      isArray = line.includes('_(array)_')
      if (!entries[currentKey]) entries[currentKey] = { en: '', he: '', isArray }
      continue
    }

    if (!currentKey) continue

    // EN value
    const enMatch = line.match(/^- EN:\s*(.*)$/)
    if (enMatch) {
      const val = enMatch[1]
      if (isArray) {
        entries[currentKey].en = val.split(' | ').map(s => s.trim()).filter(Boolean)
      } else {
        entries[currentKey].en = val
      }
      continue
    }

    // HE value
    const heMatch = line.match(/^- HE:\s*(.*)$/)
    if (heMatch) {
      const val = heMatch[1]
      if (isArray) {
        entries[currentKey].he = val.split(' | ').map(s => s.trim()).filter(Boolean)
      } else {
        entries[currentKey].he = val
      }
      currentKey = null
      isArray = false
      continue
    }
  }

  return entries
}

// ── Escape a value for JS string ──
function escapeForJs(value, quoteChar) {
  if (quoteChar === "'") return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// ── Choose quote character (prefer single, use double if value contains single) ──
function chooseQuote(value) {
  if (value.includes("'") && !value.includes('"')) return '"'
  return "'"
}

// ── Build a JS line for a key-value pair ──
function buildKvLine(key, value, origKeyQuote, origValQuote) {
  // Preserve original key quoting style
  const kq = origKeyQuote || ''
  const keyStr = kq ? `${kq}${key}${kq}` : key
  // Preserve original value quote style, but switch if needed for escaping
  let q = origValQuote || chooseQuote(value)
  // If value contains the chosen quote, switch
  if (q === "'" && value.includes("'") && !value.includes('"')) q = '"'
  else if (q === '"' && value.includes('"') && !value.includes("'")) q = "'"
  const escaped = escapeForJs(value, q)
  return `  ${keyStr}: ${q}${escaped}${q},`
}

// ── Build a JS line for an array ──
function buildArrayLine(key, values, origKeyQuote) {
  const kq = origKeyQuote || ''
  const keyStr = kq ? `${kq}${key}${kq}` : key
  const items = values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ')
  return `  ${keyStr}: [${items}],`
}

// ── Rebuild a JS file from structure + new values ──
function rebuildFile(structure, values, isLast) {
  const lines = []
  const usedKeys = new Set()

  for (let i = 0; i < structure.length; i++) {
    const item = structure[i]

    switch (item.type) {
      case 'wrapper':
        lines.push(item.raw)
        break

      case 'blank':
        lines.push('')
        break

      case 'section':
        lines.push(item.raw)
        break

      case 'comment':
        lines.push(item.raw)
        break

      case 'kv': {
        usedKeys.add(item.key)
        if (item.key in values) {
          const val = values[item.key]
          if (typeof val === 'string') {
            lines.push(buildKvLine(item.key, val, item.keyQuote, item.valQuote))
          }
        } else {
          lines.push(item.raw) // preserve original if not in MD
        }
        break
      }

      case 'array': {
        usedKeys.add(item.key)
        if (item.key in values && Array.isArray(values[item.key])) {
          lines.push(buildArrayLine(item.key, values[item.key], item.keyQuote))
        } else {
          lines.push(item.raw)
        }
        break
      }

      default:
        lines.push(item.raw)
    }
  }

  // Strip trailing comma from last key before closing brace
  // Find last non-blank, non-wrapper line
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '}') continue
    if (lines[i].trim() === '') continue
    // Remove trailing comma from the very last property
    lines[i] = lines[i].replace(/,\s*$/, '')
    break
  }

  return lines.join('\n')
}

// ── Detect line ending style of a file ──
function detectLineEnding(filePath) {
  const raw = readFileSync(filePath)
  return raw.includes('\r\n') ? '\r\n' : '\n'
}

// ── Main ──
const mdEntries = parseMd(MD_PATH)
const enStructure = parseStructure(EN_PATH)
const heStructure = parseStructure(HE_PATH)
const enLineEnding = detectLineEnding(EN_PATH)
const heLineEnding = detectLineEnding(HE_PATH)

// Build value maps from MD
const enValues = {}
const heValues = {}
for (const [key, entry] of Object.entries(mdEntries)) {
  enValues[key] = entry.en
  heValues[key] = entry.he
}

// Load original content (normalized to LF for comparison)
const origEn = readFileSync(EN_PATH, 'utf-8').replace(/\r\n/g, '\n')
const origHe = readFileSync(HE_PATH, 'utf-8').replace(/\r\n/g, '\n')

// Rebuild (always LF internally, then convert to original line ending for write)
const newEnLf = rebuildFile(enStructure, enValues)
const newHeLf = rebuildFile(heStructure, heValues)

// Count real content changes (compare LF-normalized)
let enChanges = 0
let heChanges = 0
const origEnLines = origEn.split('\n')
const newEnLines = newEnLf.split('\n')
const origHeLines = origHe.split('\n')
const newHeLines = newHeLf.split('\n')

for (let i = 0; i < Math.max(origEnLines.length, newEnLines.length); i++) {
  if ((origEnLines[i] || '').replace(/\r$/, '') !== (newEnLines[i] || '')) enChanges++
}
for (let i = 0; i < Math.max(origHeLines.length, newHeLines.length); i++) {
  if ((origHeLines[i] || '').replace(/\r$/, '') !== (newHeLines[i] || '')) heChanges++
}

console.log(`Changes detected:`)
console.log(`  en.js: ${enChanges} line(s) changed`)
console.log(`  he.js: ${heChanges} line(s) changed`)
console.log(`  Total keys in CONTENT.md: ${Object.keys(mdEntries).length}`)

if (enChanges === 0 && heChanges === 0) {
  console.log('\nNo changes to write. Files are in sync.')
} else {
  // Write with original line endings preserved
  const newEnFinal = enLineEnding === '\r\n' ? newEnLf.replace(/\n/g, '\r\n') : newEnLf
  const newHeFinal = heLineEnding === '\r\n' ? newHeLf.replace(/\n/g, '\r\n') : newHeLf
  writeFileSync(EN_PATH, newEnFinal, 'utf-8')
  writeFileSync(HE_PATH, newHeFinal, 'utf-8')
  console.log('\nFiles updated successfully!')
}
