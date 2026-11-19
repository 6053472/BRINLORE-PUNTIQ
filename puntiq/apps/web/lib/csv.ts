/** Minimale CSV-lezer voor import: BOM, puntkomma/komma/tab, aanhalingstekens en meerregelige cellen. */

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const count = (char: string) => firstLine.split(char).length - 1
  const delimiter = count(';') >= count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ','

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter(items => items.some(item => item.trim() !== ''))
}

/** "1.234,50", "52,5", "€ 900" en "52.5" → getal; leeg of onleesbaar → undefined. */
export function parseNumber(value: string | undefined): number | undefined {
  if (value == null) return undefined
  let text = value.replace(/[€\s]/g, '')
  if (!text) return undefined
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    // Het laatste teken is het decimaalteken: "1.234,50" (NL) of "1,234.50" (EN).
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (comma >= 0) {
    if (text.indexOf(',') !== comma) return undefined
    text = text.replace(',', '.')
  } else if (dot >= 0) {
    // "1.250" of "1.250.000" zijn duizendtallen (Nederlandse notatie); "52.5" en "1.25" zijn decimalen.
    const groups = text.split('.')
    if (groups.length > 2 || (groups[1].length === 3 && groups[0].length >= 1 && groups[0].length <= 3 && groups[0] !== '0')) text = groups.join('')
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : undefined
}
