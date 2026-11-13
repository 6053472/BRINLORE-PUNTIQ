import type { PublicUser, UserProfile, UserSettings } from './db'

export type { PublicUser as User, UserProfile, UserSettings }

export type ModuleId =
  | 'dashboard'
  | 'properties'
  | 'wws'
  | 'wwso'
  | 'tenants'
  | 'contracts'
  | 'maintenance'
  | 'documents'
  | 'finance'
  | 'reports'
  | 'profile'
  | 'admin'
  | 'users'
  | 'audit'
  | 'site'
  | 'settings'

export type Property = {
  id: number
  name: string
  address: string
  type: string
  status: string
  points: number
  rent: number
  image?: string
  images?: string[]
  area?: number
  rooms?: number
  bedrooms?: number
  yearBuilt?: number
  energyLabel?: string
  floor?: string
  price?: number
  description?: string
}

type Base = { id: number; createdAt: string }
export type Tenant = Base & { name: string; email?: string; phone?: string; property?: string; status: string; notes?: string }
export type ContractTerm = 'Onbepaalde tijd' | 'Bepaalde tijd'
export type Contract = Base & {
  property: string
  tenant: string
  /** Koppeling met de woning en huurder; ontbreekt bij oudere contracten (dan alleen de naam). */
  propertyId?: number
  tenantId?: number
  term?: ContractTerm
  start: string
  /** Leeg bij onbepaalde tijd. */
  end?: string
  rent?: number
  deposit?: number
  status: string
  terminatedOn?: string
  notes?: string
}
export type Maintenance = Base & { title: string; property: string; priority: string; status: string; date?: string; cost?: number; contractor?: string; description?: string }
export type DocumentItem = Base & { name: string; category: string; property?: string; contractId?: number; date?: string; size?: number; mime?: string; hasFile?: boolean }
export type InvoiceType = 'Huur' | 'Servicekosten' | 'Borg' | 'Onderhoud' | 'Overig'
/** Factuur: wat een huurder moet betalen. De betaalstatus wordt afgeleid uit de gekoppelde betalingen (lib/finance.ts). */
export type Invoice = Base & {
  number: string
  description: string
  type: InvoiceType
  tenant?: string
  tenantId?: number
  property?: string
  propertyId?: number
  contractId?: number
  /** Huurperiode (YYYY-MM) bij huurfacturen; voorkomt dubbel factureren. */
  period?: string
  amount: number
  issueDate: string
  dueDate: string
  /** Alleen 'Open' of 'Geannuleerd'; betaald/achterstallig volgt uit de betalingen. */
  status: 'Open' | 'Geannuleerd'
  notes?: string
}
export type PaymentMethod = 'Overboeking' | 'Automatische incasso' | 'iDEAL' | 'Contant' | 'Overig'
/** Ontvangen betaling. */
export type Payment = Base & {
  amount: number
  receivedOn: string
  method: PaymentMethod
  reference?: string
  invoiceId?: number
  tenant?: string
  tenantId?: number
  property?: string
  propertyId?: number
  note?: string
}
export type WwsCalculation = Base & {
  label: string
  property?: string
  date?: string
  points?: number
  rent?: number
  segment?: string
  regelset?: string
  betrouwbaarheid?: 'officieel' | 'indicatief' | 'onvolledig'
  invoer?: string
}

export type WwsoCalculation = Base & {
  label: string
  property?: string
  date?: string
  points?: number
  rent?: number
  regelset?: string
  betrouwbaarheid?: 'officieel' | 'indicatief' | 'onvolledig'
  invoer?: string
}

export type RecordKind = 'tenants' | 'contracts' | 'maintenance' | 'documents' | 'invoices' | 'payments' | 'wws' | 'wwso'
export type RecordMap = {
  tenants: Tenant[]
  contracts: Contract[]
  maintenance: Maintenance[]
  documents: DocumentItem[]
  invoices: Invoice[]
  payments: Payment[]
  wws: WwsCalculation[]
  wwso: WwsoCalculation[]
}
