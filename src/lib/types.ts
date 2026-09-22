export type Lang = 'en' | 'zh-Hant' | 'zh-Hans'
export type Tri = Record<Lang, string>

export type Role = 'chairman' | 'physician' | 'nurse' | 'pharmacist' | 'admin'

export interface Staff {
  id: string; name: Tri; role: string; departmentId: string
  credential: string; email: string; extension: string
  status: 'active' | 'on-leave'; yearsOfService: number
}

export interface Condition { icd: string; label: Tri }

export interface Patient {
  id: string; mrn: string; idMasked: string; name: Tri
  sex: 'M' | 'F'; dob: string; age: number; phone: string; district: Tri
  payerId: string; bloodType: string; allergies: Tri[]; conditions: Condition[]
  primaryPhysicianId: string; departmentId: string
  status: 'active' | 'inactive' | 'inpatient'
  lastVisit: string; acuity: number; consentResearch: boolean
  preferredLanguage: Lang
}

export interface Vitals {
  bpSystolic: number; bpDiastolic: number; heartRate: number
  tempC: number; spo2: number; weightKg: number; heightCm: number
}

export interface Encounter {
  id: string; patientId: string; date: string; type: string
  departmentId: string; physicianId: string
  chiefComplaint: Tri; diagnosis: Condition; plan: Tri
  vitals: Vitals; durationMin: number
}

export type LabFlag = 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high'

export interface Lab {
  id: string; patientId: string; date: string; panel: string; panelName: Tri
  code: string; analyte: Tri; value: number; unit: string
  refLow: number | null; refHigh: number | null; flag: LabFlag
  method: string; performingLab: Tri
}

export interface Medication {
  id: string; patientId: string; code: string; drug: Tri; drugClass: string
  dose: string; frequency: string; route: string
  startDate: string; endDate: string | null
  status: 'active' | 'discontinued'; prescriberId: string; refillsRemaining: number
}

export interface Imaging {
  id: string; patientId: string; date: string; modality: string; study: Tri
  bodyPart: string; findings: Tri; radiologistId: string
  status: 'finalised' | 'preliminary'; accession: string
}

export interface Appointment {
  id: string; patientId: string; datetime: string; departmentId: string
  physicianId: string; room: string; type: string
  status: 'scheduled' | 'checked-in' | 'completed' | 'no-show'
  interpreterNeeded: boolean; notes: string | null
}

export interface InvoiceLine {
  code: string; label: Tri; qty: number; unitPrice: number; amount: number
}

export type ClaimStatus =
  | 'draft' | 'submitted' | 'adjudicating' | 'partially-paid'
  | 'paid' | 'rejected' | 'outstanding'

export interface Invoice {
  id: string; patientId: string; date: string; payerId: string
  lines: InvoiceLine[]; grossAmount: number; coveredAmount: number
  patientResponsibility: number; currency: string
  claimStatus: ClaimStatus; claimRef: string | null
  rejectionReason: Tri | null; daysOutstanding: number
}

export interface InventoryItem {
  sku: string; name: Tri; category: 'pharmaceutical' | 'consumable' | 'reagent' | 'device'
  unit: string; onHand: number; reorderPoint: number; onOrder: number
  lot: string; expiry: string; gtin: string; supplier: Tri
  unitCostHKD: number; storage: string; controlled: boolean
}

export interface RosterEntry {
  date: string; shift: 'day' | 'evening' | 'night'
  staffIds: string[]; onCallId: string
}

export interface AuditEntry {
  id: string; timestamp: string; actorId: string; actorRole: string
  action: string; entity: string; entityId: string
  ip: string; result: 'permitted' | 'denied'; purpose: string
}

export interface Bundle {
  meta: { generatedFor: string; generatedAt: string; seed: number; synthetic: boolean; notice: Tri }
  departments: { id: string; name: Tri }[]
  payers: { id: string; name: Tri }[]
  staff: Staff[]; patients: Patient[]; encounters: Encounter[]
  labs: Lab[]; medications: Medication[]; imaging: Imaging[]
  appointments: Appointment[]; invoices: Invoice[]
  inventory: InventoryItem[]; roster: RosterEntry[]; auditLog: AuditEntry[]
}
