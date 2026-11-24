// Importing a club's own player list from a spreadsheet: finding the columns, tidying each row, and sorting rows into
// "ready to invite", "already on PadelMate", "already imported", duplicates and bad emails. Pure functions, so the
// browser (to show the check) and the server (to do it for real, never trusting the browser) use the same rules.

export const MAX_ROWS = 5000
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type Cell = string | number | Date | boolean | null | undefined
export type RawRow = Cell[]
export type Mapping = { name: number | null; nameLast: number | null; email: number | null; phone: number | null; lastPlayed: number | null }
export type ContactRow = { name: string; email: string; phone: string | null; lastPlayed: string | null }
export type MappedRow = ContactRow & { line: number }

const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Which of the file's columns is which, from its headings. null means "not in my file".
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map(squash)
  const find = (...tests: RegExp[]): number | null => { for (const t of tests) { const i = h.findIndex(x => x && t.test(x)); if (i >= 0) return i } return null }
  const email = find(/^e?mail(address)?$/, /email/)
  const first = find(/^(first|given)name$/, /^firstname/, /^first$/)
  const last = find(/^(last|sur|family)name$/, /^lastname/, /^surname$/)
  const full = find(/^(full)?name$/, /^(customer|player|member|client|contact)(name)?$/, /fullname/)
  const lastPlayed = find(/^last(played|booking|booked|visit|seen|activity|game)/, /lastplay/, /lastbook/, /lastvisit/, /^lastdate$/)
  const phone = find(/^(mobile|phone|cell|tel)/, /mobile/, /phone/)
  if (full != null) return { name: full, nameLast: null, email, phone, lastPlayed }
  return { name: first, nameLast: first != null ? last : null, email, phone, lastPlayed }
}

export const normEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase()
export function isEmail(v: string): boolean {
  if (!v || v.length > 254 || /\s/.test(v) || v.includes('..')) return false
  return /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/.test(v) && v.split('@').length === 2
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ymd = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
const fullYear = (y: number) => (y < 100 ? 2000 + y : y)

// A date from whatever the file holds: a real date cell, an Excel number, 2025-11-12, 12/11/2025 (day first, as in NZ),
// or "12 Nov 2025". Anything unreadable, in the future or before 2000 comes back null: better no date than a wrong one.
export function parseLastPlayed(v: Cell, nowMs: number = Date.now()): string | null {
  let out: string | null = null
  if (v instanceof Date && !isNaN(v.getTime())) out = ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
  else if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 20000 && v < 80000) { const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000); out = ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()) }
  } else if (typeof v === 'string') {
    const s = v.trim()
    let m: RegExpMatchArray | null
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) out = ymd(+m[1], +m[2], +m[3])
    else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/))) out = ymd(fullYear(+m[3]), +m[2], +m[1])
    else if ((m = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{2}|\d{4})$/))) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); if (mi >= 0) out = ymd(fullYear(+m[3]), mi + 1, +m[1])
    }
  }
  if (!out) return null
  if (out < '2000-01-01') return null
  if (Date.parse(`${out}T00:00:00Z`) > nowMs + 86400000) return null
  return out
}

const titleCase = (s: string) => s.replace(/\b([a-z])/g, c => c.toUpperCase())
export function cleanName(v: unknown, email = ''): string {
  // eslint-disable-next-line no-control-regex
  const n = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (n) return n
  const local = email.split('@')[0] ?? ''
  return titleCase(local.replace(/[._\-+]+/g, ' ').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 80) || 'Player'
}
export function cleanPhone(v: unknown): string | null {
  const p = String(v ?? '').replace(/[^\d+()\-\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
  return p.replace(/\D/g, '').length >= 6 ? p : null
}

const text = (c: Cell): string => (c instanceof Date ? '' : String(c ?? '').trim())

// Turn the file's rows into tidy contacts. Rows with nothing in them are dropped; `line` is the row's number in the file
// (the heading row is line 1), so a problem can be pointed to.
export function mapRows(rows: RawRow[], m: Mapping, nowMs: number = Date.now()): { rows: MappedRow[]; blank: number } {
  const out: MappedRow[] = []; let blank = 0
  rows.forEach((r, i) => {
    const cell = (idx: number | null) => (idx == null ? undefined : r[idx])
    const email = normEmail(text(cell(m.email) as Cell))
    const first = text(cell(m.name) as Cell), last = m.nameLast != null ? text(cell(m.nameLast) as Cell) : ''
    const name = [first, last].filter(Boolean).join(' ')
    if (!email && !name && !text(cell(m.phone) as Cell)) { blank++; return }
    out.push({ line: i + 2, name: cleanName(name, email), email, phone: cleanPhone(text(cell(m.phone) as Cell)), lastPlayed: m.lastPlayed != null ? parseLastPlayed(cell(m.lastPlayed) as Cell, nowMs) : null })
  })
  return { rows: out, blank }
}

export type Known = { profiles: Map<string, string>; contacts: Set<string> } // email -> user id; emails already imported
export type Classified = {
  total: number
  ready: MappedRow[]
  onPadelmate: (MappedRow & { userId: string })[]
  alreadyImported: MappedRow[]
  duplicates: number
  duplicateRows: MappedRow[]
  invalid: MappedRow[]
}
// Sorts every row into exactly one group, so the numbers on screen always add up to the rows in the file.
export function classify(rows: MappedRow[], known: Known): Classified {
  const seen = new Set<string>()
  const c: Classified = { total: rows.length, ready: [], onPadelmate: [], alreadyImported: [], duplicates: 0, duplicateRows: [], invalid: [] }
  for (const r of rows) {
    if (!isEmail(r.email)) { c.invalid.push(r); continue }
    if (seen.has(r.email)) { c.duplicates++; c.duplicateRows.push(r); continue }
    seen.add(r.email)
    const uid = known.profiles.get(r.email)
    if (uid) c.onPadelmate.push({ ...r, userId: uid })
    else if (known.contacts.has(r.email)) c.alreadyImported.push(r)
    else c.ready.push(r)
  }
  return c
}

// What the server accepts from the browser for each row: strictly shaped, never trusted.
export function sanitizeRow(raw: any): ContactRow | null {
  if (!raw || typeof raw !== 'object') return null
  const email = normEmail(raw.email)
  if (!isEmail(email)) return null
  const lp = typeof raw.lastPlayed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastPlayed) ? parseLastPlayed(raw.lastPlayed) : null
  return { name: cleanName(raw.name, email), email, phone: cleanPhone(raw.phone), lastPlayed: lp }
}

// A CSV (or tab or semicolon separated) file into rows of text. Handles quotes, line breaks inside quotes and a leading BOM.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => first.split(ch).length - 1
  const delim = count('\t') > Math.max(count(','), count(';')) ? '\t' : count(';') > count(',') ? ';' : ','
  const rows: string[][] = []; let row: string[] = [], cur = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else quoted = false } else cur += ch
    } else if (ch === '"' && cur === '') quoted = true
    else if (ch === delim) { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = [] }
    else cur += ch
  }
  row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row)
  return rows
}
