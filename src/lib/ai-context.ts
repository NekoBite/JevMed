/**
 * Builds the CONTEXT block the assistant reads.
 *
 * The context is assembled on the client and posted with each turn, which keeps
 * the server stateless about clinical content. It is written as plain readable
 * text rather than JSON — a model reads a chart note far better than it reads a
 * nested object, and a human debugging a bad answer can read it too.
 *
 * English field labels are used regardless of interface language: the labels are
 * for the model, and the reply language is set separately in the system prompt.
 */
import {
  getPatient, staffById, departmentsById, payersById, encountersFor,
  latestLabPanel, medsFor, imagingFor, invoicesFor, apptsFor,
  db, TODAY, inventoryTotals, stockState, billingTotals, criticalLabs,
  todaysAppointments, rejectedClaims, daysUntil,
} from './data'
import { pickTri } from '@/i18n'
import type { Lang } from './types'

const E = (v: Parameters<typeof pickTri>[1]) => pickTri('en' as Lang, v)

export function patientContext(patientId: string): string {
  const p = getPatient(patientId)
  if (!p) return ''

  const doc = staffById.get(p.primaryPhysicianId)
  const dep = departmentsById.get(p.departmentId)
  const payer = payersById.get(p.payerId)
  const encs = encountersFor(p.id).slice().sort((a, b) => b.date.localeCompare(a.date))
  const labs = latestLabPanel(p.id)
  const meds = medsFor(p.id)
  const imgs = imagingFor(p.id)
  const bills = invoicesFor(p.id)
  const appts = apptsFor(p.id).filter((a) => a.datetime.slice(0, 10) >= TODAY)

  const L: string[] = []
  L.push(`Today's date in this system: ${TODAY}`)
  L.push('')
  L.push('### PATIENT')
  L.push(`Name: ${E(p.name)} (${p.name['zh-Hant']} / ${p.name['zh-Hans']})`)
  L.push(`File number: ${p.mrn} · Identity document: ${p.idMasked} (masked)`)
  L.push(`Age ${p.age}, ${p.sex === 'M' ? 'male' : 'female'}, born ${p.dob}, blood group ${p.bloodType}`)
  L.push(`Status: ${p.status} · Department: ${dep ? E(dep.name) : '—'} · Payer: ${payer ? E(payer.name) : '—'}`)
  L.push(`Responsible physician: ${doc ? `${E(doc.name)}, ${doc.credential}` : '—'}`)
  L.push(`District: ${E(p.district)} · Preferred language: ${p.preferredLanguage}`)
  L.push(`Last seen: ${p.lastVisit} · Acuity score: ${p.acuity}/100`)
  L.push(`Secondary-use consent: ${p.consentResearch ? 'given (research permitted)' : 'withheld (direct care only)'}`)
  L.push('')
  L.push(`Allergies: ${p.allergies.length ? p.allergies.map(E).join('; ') : 'No known drug allergy'}`)
  L.push(`Active problems: ${p.conditions.map((c) => `${c.icd} ${E(c.label)}`).join('; ')}`)

  if (meds.length) {
    L.push('')
    L.push('### MEDICATIONS')
    for (const m of meds) {
      L.push(`- ${E(m.drug)} (${m.drugClass}) ${m.dose} ${m.frequency} ${m.route} · started ${m.startDate} · ${m.status}${m.endDate ? ` (stopped ${m.endDate})` : ''}`)
    }
  }

  if (labs.length) {
    L.push('')
    L.push('### MOST RECENT LABORATORY RESULTS (one row per analyte)')
    for (const l of labs) {
      const ref = l.refLow !== null && l.refHigh !== null ? `${l.refLow}–${l.refHigh}`
        : l.refHigh !== null ? `< ${l.refHigh}` : l.refLow !== null ? `> ${l.refLow}` : 'n/a'
      L.push(`- ${l.date} ${E(l.analyte)} (${l.code}): ${l.value} ${l.unit} [ref ${ref}] — ${l.flag} · method ${l.method}, ${E(l.performingLab)}`)
    }
  }

  if (encs.length) {
    L.push('')
    L.push('### ENCOUNTERS (most recent first)')
    for (const e of encs.slice(0, 8)) {
      const seen = staffById.get(e.physicianId)
      L.push(`- ${e.date} · ${e.type} · seen by ${seen ? E(seen.name) : '—'}`)
      L.push(`    Complaint: ${E(e.chiefComplaint)}`)
      L.push(`    Diagnosis: ${e.diagnosis.icd} ${E(e.diagnosis.label)}`)
      L.push(`    Vitals: BP ${e.vitals.bpSystolic}/${e.vitals.bpDiastolic} mmHg, HR ${e.vitals.heartRate}/min, temp ${e.vitals.tempC} °C, SpO2 ${e.vitals.spo2}%, weight ${e.vitals.weightKg} kg, height ${e.vitals.heightCm} cm`)
      L.push(`    Plan: ${E(e.plan)}`)
    }
  }

  if (imgs.length) {
    L.push('')
    L.push('### IMAGING')
    for (const i of imgs) {
      L.push(`- ${i.date} ${i.modality} ${E(i.study)} (${i.bodyPart}) — ${i.status}: ${E(i.findings)}`)
    }
  }

  if (appts.length) {
    L.push('')
    L.push('### UPCOMING APPOINTMENTS')
    for (const a of appts.slice(0, 6)) {
      const dep2 = departmentsById.get(a.departmentId)
      L.push(`- ${a.datetime} · ${dep2 ? E(dep2.name) : '—'} · ${a.type} · ${a.room} · ${a.status}${a.interpreterNeeded ? ' · interpreter required' : ''}`)
    }
  }

  if (bills.length) {
    L.push('')
    L.push('### BILLING')
    for (const b of bills) {
      L.push(`- ${b.id} ${b.date} · gross ${b.grossAmount} ${b.currency}, covered ${b.coveredAmount}, patient pays ${b.patientResponsibility} · claim ${b.claimStatus}${b.rejectionReason ? ` — rejected: ${E(b.rejectionReason)}` : ''}`)
    }
  }

  return L.join('\n')
}

export function systemContext(): string {
  const inv = inventoryTotals()
  const bill = billingTotals()
  const crit = criticalLabs()
  const today = todaysAppointments()
  const rejected = rejectedClaims()

  const L: string[] = []
  L.push(`Today's date in this system: ${TODAY}`)
  L.push('No individual patient record is open. The figures below are network-wide aggregates.')
  L.push('')
  L.push('### NETWORK AT A GLANCE')
  L.push(`Patients on file: ${db.patients.length} (${db.patients.filter((p) => p.status !== 'inactive').length} active, ${db.patients.filter((p) => p.status === 'inpatient').length} inpatient)`)
  L.push(`Staff: ${db.staff.length} · Departments: ${db.departments.length}`)
  L.push(`Appointments today: ${today.length} · Total scheduled in system: ${db.appointments.length}`)
  L.push(`Laboratory results flagged critical: ${crit.length}`)
  L.push('')
  L.push('### BILLING AND CLAIMS')
  L.push(`Billed: ${Math.round(bill.billed)} HKD · Settled: ${Math.round(bill.settled)} HKD · Outstanding: ${Math.round(bill.outstanding)} HKD`)
  L.push(`Rejection rate: ${(bill.rejectRate * 100).toFixed(1)}%`)
  if (rejected.length) {
    L.push('Rejected claims:')
    for (const r of rejected) {
      L.push(`- ${r.id} · ${r.date} · ${Math.round(r.grossAmount)} HKD · reason: ${r.rejectionReason ? E(r.rejectionReason) : 'not recorded'}`)
    }
  }
  L.push('')
  L.push('### INVENTORY')
  L.push(`Stock lines: ${inv.lines} · Total value: ${Math.round(inv.value)} HKD`)
  L.push(`At or below reorder point: ${inv.belowReorder} · Expiring within 90 days: ${inv.expiring} · Already expired: ${inv.expired}`)
  const needsAction = db.inventory
    .map((i) => ({ i, s: stockState(i) }))
    .filter(({ s }) => s !== 'ok')
  if (needsAction.length) {
    L.push('Lines needing action:')
    for (const { i, s } of needsAction) {
      L.push(`- ${i.sku} ${E(i.name)} · on hand ${i.onHand} (reorder at ${i.reorderPoint}), on order ${i.onOrder} · lot ${i.lot} expires ${i.expiry} (${daysUntil(i.expiry)} days) · ${s} · supplier ${E(i.supplier)}`)
    }
  }
  L.push('')
  L.push('### DEPARTMENT ACTIVITY (encounters recorded)')
  const byDept = new Map<string, number>()
  for (const e of db.encounters) byDept.set(e.departmentId, (byDept.get(e.departmentId) ?? 0) + 1)
  for (const [id, n] of [...byDept.entries()].sort((a, b) => b[1] - a[1])) {
    const d = departmentsById.get(id)
    if (d) L.push(`- ${E(d.name)}: ${n}`)
  }
  return L.join('\n')
}
