import type { Role } from './types'

export const ROLES: Role[] = ['chairman', 'physician', 'nurse', 'pharmacist', 'admin']

/** Which staff member each demo role signs in as. */
export const ROLE_STAFF: Record<Role, string> = {
  chairman: 'S017',   // Ms. Hui Yuen-ching — standing in for the board office
  physician: 'S001',  // Dr. Chan Ka-ming
  nurse: 'S011',      // Ms. Lau Yuk-lan
  pharmacist: 'S015', // Mr. Yip Ho-yin
  admin: 'S017',
}

export type Section =
  | 'dashboard' | 'patients' | 'appointments'
  | 'billing' | 'inventory' | 'staff' | 'audit'

/**
 * Access matrix. The chairman deliberately cannot open an identified patient
 * record: a governance role needs aggregates, and giving it record-level
 * access by default is how avoidable breaches happen.
 */
const MATRIX: Record<Role, Section[]> = {
  chairman:   ['dashboard', 'billing', 'inventory', 'staff', 'audit'],
  physician:  ['dashboard', 'patients', 'appointments', 'billing', 'staff'],
  nurse:      ['dashboard', 'patients', 'appointments', 'inventory', 'staff'],
  pharmacist: ['dashboard', 'patients', 'inventory', 'staff'],
  admin:      ['dashboard', 'patients', 'appointments', 'billing', 'inventory', 'staff', 'audit'],
}

export const can = (role: Role, section: Section): boolean => MATRIX[role].includes(section)

/** Record-level patient access, separate from merely seeing the registry tab. */
export const canOpenPatientRecord = (role: Role): boolean => role !== 'chairman'

/** The assistant reads clinical detail, so it follows record-level access. */
export const canUseAssistant = (role: Role): boolean => role !== 'chairman'
