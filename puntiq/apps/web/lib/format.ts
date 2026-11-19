export const money = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

export const moneyShort = (n: number) =>
  n >= 1_000_000
    || Math.round(n / 1000) >= 1000 ? `€ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
    : n >= 10_000 && Math.round(n / 1000) < 1000
      ? `€ ${Math.round(n / 1000)}k`
      : money(n)

const pad = (n: number) => String(n).padStart(2, '0')

/** Lokale datum als ISO (YYYY-MM-DD), zonder tijdzone-verschuiving. */
export const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const today = () => toIso(new Date())

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

export function addMonths(iso: string, months: number) {
  const date = new Date(`${iso}T00:00:00`)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Einde van de maand afvangen (31 jan + 1 maand = 28/29 feb).
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
  return toIso(date)
}

export function daysBetween(fromIso: string, toIsoDate: string) {
  const from = new Date(`${fromIso}T00:00:00`).getTime()
  const to = new Date(`${toIsoDate}T00:00:00`).getTime()
  return Math.round((to - from) / 86_400_000)
}

export function formatDate(iso?: string) {
  if (!iso) return '—'
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '')
}

export function formatDateTime(iso?: string) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date).replace('.', '')
}

export function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 6 ? 'Goedenacht' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
}

export function longDate(date = new Date()) {
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export const monthLabel = (date: Date) => new Intl.DateTimeFormat('nl-NL', { month: 'short' }).format(date).replace('.', '')
export const monthKey = (iso: string) => iso.slice(0, 7)

export const slug = (value: string) => [...value.normalize('NFD')].filter(char => char.charCodeAt(0) < 128).join('').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function downloadCsv(filename: string, rows: (string | number | undefined | null)[][]) {
  const escape = (cell: string | number | undefined | null) => {
    // Getallen met decimale komma (Excel nl-NL); tekst die met = + - @ begint krijgt een apostrof (formule-injectie).
    let text = cell == null ? '' : typeof cell === 'number' ? String(cell).replace('.', ',') : String(cell)
    if (typeof cell === 'string' && (/^[-=+@]/.test(text) || text.startsWith(String.fromCharCode(9)) || text.startsWith(String.fromCharCode(13)))) text = `'${text}`
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  // Puntkomma + BOM zodat Excel (nl-NL) het bestand direct goed opent.
  const body = `﻿${rows.map(row => row.map(escape).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Verkleint een afbeelding client-side zodat uploads klein blijven. */
export function resizeImage(file: File, maxSize: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Afbeelding kon niet worden geladen.'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('Afbeelding kon niet worden verwerkt.'))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}
