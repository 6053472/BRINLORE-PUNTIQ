/**
 * Validatie en normalisatie van profiel- en bedrijfsgegevens.
 * Bewust zonder Node-imports: wordt zowel in de browser als op de server gebruikt.
 */

export type ProfileKey =
  | 'firstName' | 'lastName' | 'phone' | 'jobTitle'
  | 'company' | 'kvk' | 'btw' | 'iban' | 'address' | 'postcode' | 'city'

type Result = { value: string; error?: string }

const compact = (value: string) => value.replace(/[\s.-]/g, '').toUpperCase()

/** IBAN-controle met de officiële mod-97-check. */
export function isValidIban(raw: string) {
  const iban = compact(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith('NL') && iban.length !== 18) return false
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

const rules: Partial<Record<ProfileKey, (value: string) => Result>> = {
  phone: value => (/^\+?[\d\s()-]{6,20}$/.test(value) ? { value } : { value, error: 'Vul een geldig telefoonnummer in.' }),
  kvk: value => {
    const digits = value.replace(/\s/g, '')
    return /^\d{8}$/.test(digits) ? { value: digits } : { value, error: 'Een KvK-nummer bestaat uit 8 cijfers.' }
  },
  btw: value => {
    const btw = compact(value)
    if (btw.startsWith('NL')) return /^NL\d{9}B\d{2}$/.test(btw) ? { value: btw } : { value, error: 'Een Nederlands btw-nummer heeft de vorm NL123456789B01.' }
    return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(btw) ? { value: btw } : { value, error: 'Vul een geldig btw-nummer in, bijvoorbeeld NL123456789B01.' }
  },
  iban: value => {
    if (!isValidIban(value)) return { value, error: 'Dit IBAN-nummer is ongeldig. Controleer de cijfers.' }
    return { value: compact(value).replace(/(.{4})(?=.)/g, '$1 ') }
  },
  postcode: value => {
    const match = value.replace(/\s/g, '').toUpperCase().match(/^(\d{4})([A-Z]{2})$/)
    if (match) return match[1].startsWith('0') ? { value, error: 'Een postcode begint niet met 0.' } : { value: `${match[1]} ${match[2]}` }
    // Buitenlandse postcodes: alleen lengte en tekens controleren.
    return /^[A-Za-z0-9 -]{3,10}$/.test(value) ? { value } : { value, error: 'Vul een geldige postcode in, bijvoorbeeld 1234 AB.' }
  },
}

/** Normaliseert één veld. Lege waarden zijn altijd toegestaan. */
export function checkProfileField(key: ProfileKey, raw: string): Result {
  const value = raw.trim()
  if (!value) return { value: '' }
  return rules[key]?.(value) ?? { value }
}

export type PasswordCheck = { id: string; label: string; ok: boolean; required: boolean }

/** Zelfde regels als passwordPolicyError op de server, plus aanbevelingen voor de sterktemeter. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: 'length', label: 'Minimaal 8 tekens', ok: password.length >= 8, required: true },
    { id: 'letter', label: 'Minimaal één letter', ok: /[a-zA-Z]/.test(password), required: true },
    { id: 'digit', label: 'Minimaal één cijfer', ok: /\d/.test(password), required: true },
    { id: 'long', label: '12 tekens of meer', ok: password.length >= 12, required: false },
    { id: 'mixed', label: 'Hoofdletters, kleine letters en een leesteken', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password), required: false },
  ]
}

/** Sterkte van 0 (leeg) tot 4 (sterk). */
export function passwordStrength(password: string) {
  if (!password) return 0
  const checks = passwordChecks(password)
  if (checks.some(check => check.required && !check.ok)) return 1
  return 2 + checks.filter(check => !check.required && check.ok).length
}
