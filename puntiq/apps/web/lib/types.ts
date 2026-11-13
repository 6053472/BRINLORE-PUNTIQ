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
export type Contract = Base & { property: string; tenant: string; start: string; end: string; rent?: number; deposit?: number; status: string; notes?: string }
export type Maintenance = Base & { title: string; property: string; priority: string; status: string; date?: string; cost?: number; contractor?: string; description?: string }
export type DocumentItem = Base & { name: string; category: string; property?: string; date?: string; size?: number; mime?: string; hasFile?: boolean }
export type Payment = Base & { description: string; property?: string; tenant?: string; type: string; amount: number; dueDate: string; status: string; paidDate?: string }
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

export type RecordKind = 'tenants' | 'contracts' | 'maintenance' | 'documents' | 'payments' | 'wws' | 'wwso'
export type RecordMap = {
  tenants: Tenant[]
  contracts: Contract[]
  maintenance: Maintenance[]
  documents: DocumentItem[]
  payments: Payment[]
  wws: WwsCalculation[]
  wwso: WwsoCalculation[]
}
