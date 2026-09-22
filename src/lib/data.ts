import raw from '@/data/mock.json'
import type {
  Bundle, Patient, Encounter, Lab, Medication, Imaging,
  Appointment, Invoice, InventoryItem, Staff, AuditEntry, RosterEntry,
} from './types'

export const db = raw as unknown as Bundle

/** The dataset's fixed "today". Keeping this explicit — rather than reading the
 *  wall clock — is what makes the demo look the same in every screening. */
export const TODAY = db.meta.generatedAt

// ── Indices (built once at module load) ─────────────────────────────────────
const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
const groupBy = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x); else m.set(k, [x])
  }
  return m
}

export const patientsById = byId(db.patients)
export const staffById = byId(db.staff)
export const departmentsById = new Map(db.departments.map((d) => [d.id, d]))
export const payersById = new Map(db.payers.map((p) => [p.id, p]))

const encountersByPatient = groupBy(db.encounters, (e) => e.patientId)
const labsByPatient = groupBy(db.labs, (l) => l.patientId)
const medsByPatient = groupBy(db.medications, (m) => m.patientId)
const imagingByPatient = groupBy(db.imaging, (i) => i.patientId)
const invoicesByPatient = groupBy(db.invoices, (i) => i.patientId)
const apptsByPatient = groupBy(db.appointments, (a) => a.patientId)

export const getPatient = (id: string): Patient | undefined => patientsById.get(id)
export const getStaff = (id: string): Staff | undefined => staffById.get(id)
export const encountersFor = (id: string): Encounter[] => encountersByPatient.get(id) ?? []
export const labsFor = (id: string): Lab[] => labsByPatient.get(id) ?? []
export const medsFor = (id: string): Medication[] => medsByPatient.get(id) ?? []
export const imagingFor = (id: string): Imaging[] => imagingByPatient.get(id) ?? []
export const invoicesFor = (id: string): Invoice[] => invoicesByPatient.get(id) ?? []
export const apptsFor = (id: string): Appointment[] => apptsByPatient.get(id) ?? []

// ── Derived views used by more than one page ────────────────────────────────

export const criticalLabs = (): Lab[] =>
  db.labs.filter((l) => l.flag === 'critical-high' || l.flag === 'critical-low')

export const todaysAppointments = (): Appointment[] =>
  db.appointments.filter((a) => a.datetime.startsWith(TODAY))

export const daysUntil = (isoDate: string): number =>
  Math.round((Date.parse(isoDate) - Date.parse(TODAY)) / 86400000)

export type StockState = 'ok' | 'low' | 'out' | 'expiring' | 'expired'

/** One item can be both low and expiring; the most urgent state wins, because
 *  a single colour in a table is only useful if it means one thing. */
export function stockState(i: InventoryItem): StockState {
  const d = daysUntil(i.expiry)
  if (d < 0) return 'expired'
  if (i.onHand === 0) return 'out'
  if (d <= 90) return 'expiring'
  if (i.onHand <= i.reorderPoint) return 'low'
  return 'ok'
}

export const stockValue = (i: InventoryItem): number => i.onHand * i.unitCostHKD

export const openClaims = (): Invoice[] =>
  db.invoices.filter((i) => !['paid'].includes(i.claimStatus))

export const rejectedClaims = (): Invoice[] =>
  db.invoices.filter((i) => i.claimStatus === 'rejected')

export function latestEncounter(patientId: string): Encounter | undefined {
  return encountersFor(patientId).slice().sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** Most recent value for each analyte, newest first. */
export function latestLabPanel(patientId: string): Lab[] {
  const seen = new Set<string>()
  const out: Lab[] = []
  for (const l of labsFor(patientId).slice().sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(l.code)) continue
    seen.add(l.code)
    out.push(l)
  }
  return out
}

/** Full history of one analyte, oldest first — for sparkline trends. */
export function labSeries(patientId: string, code: string): Lab[] {
  return labsFor(patientId).filter((l) => l.code === code)
    .slice().sort((a, b) => a.date.localeCompare(b.date))
}

export const activeMeds = (patientId: string): Medication[] =>
  medsFor(patientId).filter((m) => m.status === 'active')

export function rosterForDate(date: string): RosterEntry[] {
  return db.roster.filter((r) => r.date === date)
}

export const recentAudit = (limit = 60): AuditEntry[] => db.auditLog.slice(0, limit)

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Number((weightKg / (m * m)).toFixed(1))
}

// ── Aggregates for the dashboard ────────────────────────────────────────────

export function encountersByDepartment() {
  const m = new Map<string, number>()
  for (const e of db.encounters) m.set(e.departmentId, (m.get(e.departmentId) ?? 0) + 1)
  return [...m.entries()]
    .map(([id, count]) => ({ id, count, dept: departmentsById.get(id)! }))
    .filter((x) => x.dept)
    .sort((a, b) => b.count - a.count)
}

export function claimStatusBreakdown() {
  const m = new Map<string, { count: number; amount: number }>()
  for (const i of db.invoices) {
    const cur = m.get(i.claimStatus) ?? { count: 0, amount: 0 }
    cur.count++; cur.amount += i.grossAmount
    m.set(i.claimStatus, cur)
  }
  return [...m.entries()].map(([status, v]) => ({ status, ...v }))
    .sort((a, b) => b.amount - a.amount)
}

export function ageBands() {
  const bands = [
    { key: '<50', lo: 0, hi: 49 },
    { key: '50–64', lo: 50, hi: 64 },
    { key: '65–74', lo: 65, hi: 74 },
    { key: '75–84', lo: 75, hi: 84 },
    { key: '85+', lo: 85, hi: 200 },
  ]
  return bands.map((b) => ({
    band: b.key,
    count: db.patients.filter((p) => p.age >= b.lo && p.age <= b.hi).length,
  }))
}

export function receivablesAgeing() {
  const buckets = [
    { key: '0–30', lo: 0, hi: 30 },
    { key: '31–60', lo: 31, hi: 60 },
    { key: '61–90', lo: 61, hi: 90 },
    { key: '90+', lo: 91, hi: 99999 },
  ]
  return buckets.map((b) => ({
    bucket: b.key,
    amount: db.invoices
      .filter((i) => i.claimStatus !== 'paid' && i.daysOutstanding >= b.lo && i.daysOutstanding <= b.hi)
      .reduce((s, i) => s + (i.grossAmount - i.coveredAmount), 0),
  }))
}

export function billingTotals() {
  const billed = db.invoices.reduce((s, i) => s + i.grossAmount, 0)
  const settled = db.invoices.reduce((s, i) => s + i.coveredAmount, 0)
  const outstanding = db.invoices
    .filter((i) => i.claimStatus !== 'paid')
    .reduce((s, i) => s + (i.grossAmount - i.coveredAmount), 0)
  const withPayer = db.invoices.filter((i) => i.payerId !== 'SELF')
  const rejectRate = withPayer.length
    ? db.invoices.filter((i) => i.claimStatus === 'rejected').length / withPayer.length
    : 0
  return { billed, settled, outstanding, rejectRate }
}

export function inventoryTotals() {
  const value = db.inventory.reduce((s, i) => s + stockValue(i), 0)
  const belowReorder = db.inventory.filter((i) => i.onHand <= i.reorderPoint).length
  const expiring = db.inventory.filter((i) => {
    const d = daysUntil(i.expiry)
    return d >= 0 && d <= 90
  }).length
  const expired = db.inventory.filter((i) => daysUntil(i.expiry) < 0).length
  return { lines: db.inventory.length, value, belowReorder, expiring, expired }
}

export function staffOnDutyToday(): Staff[] {
  const ids = new Set(rosterForDate(TODAY).flatMap((r) => r.staffIds))
  return db.staff.filter((s) => ids.has(s.id))
}
