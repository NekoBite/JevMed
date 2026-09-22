/**
 * Deterministic mock-data generator for the JevMed ERP demo.
 *
 * Everything in this file is SYNTHETIC. No real patient, clinician, payer
 * account or transaction is represented. The generator is seeded so that every
 * build produces byte-identical data — demos stay reproducible and screenshots
 * taken today still match the system next month.
 *
 *   npm run seed
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPARTMENTS, CONDITIONS, LAB_PANELS, DRUGS, ALLERGENS, SURNAMES,
  GIVEN_M, GIVEN_F, DISTRICTS, PAYERS, IMAGING,
} from './reference-tables.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/mock.json')

// ── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
let _s = 0x9e3779b9
const seed = (n) => { _s = n >>> 0 }
function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const chance = (p) => rnd() < p
const round = (v, dp) => Number(v.toFixed(dp))
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const pad = (n, w = 3) => String(n).padStart(w, '0')

// "Today" is fixed so the dataset never drifts relative to itself.
const TODAY = new Date('2026-09-22T00:00:00Z')
const dayMs = 86400000
const shift = (days) => new Date(TODAY.getTime() + days * dayMs)
const iso = (d) => d.toISOString().slice(0, 10)
const isoT = (d) => d.toISOString().slice(0, 16).replace('T', ' ')

const tri = (en, hant, hans) => ({ en, 'zh-Hant': hant, 'zh-Hans': hans })

seed(20260922)

// ── Staff ───────────────────────────────────────────────────────────────────
const STAFF_SPEC = [
  ['Dr. Chan Ka-ming',    '陳家明 醫生', '陈家明 医生',  'physician', 'IM',   'MBBS, FHKAM (Medicine)'],
  ['Dr. Wong Mei-ling',   '黃美玲 醫生', '黄美玲 医生',  'physician', 'CARD', 'MBBS, FRCP (Edin), FHKAM'],
  ['Dr. Leung Chi-hung',  '梁志雄 醫生', '梁志雄 医生',  'physician', 'ENDO', 'MBChB, MRCP (UK)'],
  ['Dr. Tsang Suk-yee',   '曾淑儀 醫生', '曾淑仪 医生',  'physician', 'NEPH', 'MBBS, FHKAM (Medicine)'],
  ['Dr. Ho Kwok-wah',     '何國華 醫生', '何国华 医生',  'physician', 'ORTH', 'MBBS, FRCS (Orth)'],
  ['Dr. Zhang Wei',       '張偉 醫生',   '张伟 医生',    'physician', 'ONCO', 'MD, PhD (Sun Yat-sen)'],
  ['Dr. Lam Wing-yee',    '林詠儀 醫生', '林咏仪 医生',  'physician', 'NEUR', 'MBBS, FHKAM (Medicine)'],
  ['Dr. Ng Tak-sing',     '吳德誠 醫生', '吴德诚 医生',  'physician', 'RESP', 'MBBS, MRCP (UK)'],
  ['Dr. Cheung Pui-shan', '張佩珊 醫生', '张佩珊 医生',  'radiologist','RAD', 'MBBS, FRCR'],
  ['Dr. Kwok Man-ho',     '郭文浩 醫生', '郭文浩 医生',  'physician', 'ER',   'MBBS, FHKCEM'],
  ['Ms. Lau Yuk-lan',     '劉玉蘭 姑娘', '刘玉兰 护士',  'nurse',     'NURS', 'RN, BN (CUHK)'],
  ['Ms. Fung Lai-chun',   '馮麗珍 姑娘', '冯丽珍 护士',  'nurse',     'NURS', 'RN, Advanced Practice'],
  ['Mr. Tam Chun-kit',    '譚俊傑 先生', '谭俊杰 先生',  'nurse',     'ER',   'RN, ACLS Instructor'],
  ['Ms. Li Na',           '李娜 姑娘',   '李娜 护士',    'nurse',     'ONCO', 'RN, Oncology Cert.'],
  ['Mr. Yip Ho-yin',      '葉浩然 先生', '叶浩然 先生',  'pharmacist','PHAR', 'BPharm, MPS (HK)'],
  ['Ms. Cheng Sze-wai',   '鄭詩慧 女士', '郑诗慧 女士',  'pharmacist','PHAR', 'BPharm (HKU)'],
  ['Ms. Hui Yuen-ching',  '許婉晴 女士', '许婉晴 女士',  'admin',     'IM',   'BBA, Health Services Mgmt'],
  ['Mr. Ma Kin-fai',      '馬健輝 先生', '马健辉 先生',  'admin',     'PHAR', 'Dip. Supply Chain Mgmt'],
]
const staff = STAFF_SPEC.map((s, i) => ({
  id: `S${pad(i + 1)}`,
  name: tri(s[0], s[1], s[2]),
  role: s[3],
  departmentId: s[4],
  credential: s[5],
  email: `${s[0].toLowerCase().replace(/^(dr|ms|mr)\.\s*/, '').replace(/[^a-z]+/g, '.')}@jevmed.example`,
  extension: `2${int(100, 999)}`,
  status: chance(0.9) ? 'active' : 'on-leave',
  yearsOfService: int(2, 27),
}))
const physicians = staff.filter((s) => s.role === 'physician' || s.role === 'radiologist')

// ── Patients ────────────────────────────────────────────────────────────────
const N_PATIENTS = 32
const patients = []
for (let i = 0; i < N_PATIENTS; i++) {
  const sex = chance(0.5) ? 'M' : 'F'
  const sn = pick(SURNAMES)
  const gn = pick(sex === 'M' ? GIVEN_M : GIVEN_F)
  // Cohort skews elderly — matches the service line this system is built for.
  const age = chance(0.7) ? int(62, 91) : int(34, 61)
  const dob = shift(-(age * 365 + int(0, 364)))
  const district = pick(DISTRICTS)
  const payer = pick(PAYERS)
  const nCond = chance(0.55) ? int(2, 4) : 1
  const conds = shuffle(CONDITIONS).slice(0, nCond)
  const primary = pick(physicians.filter((p) => p.role === 'physician'))
  const allergies = chance(0.35) ? shuffle(ALLERGENS).slice(0, int(1, 2)) : []
  const lastVisit = shift(-int(1, 210))
  const idLetter = String.fromCharCode(65 + int(0, 25))

  patients.push({
    id: `P${pad(i + 1, 4)}`,
    mrn: `JM-${2026}-${pad(i + 1, 4)}`,
    // Identity document deliberately masked — the registry shows a check
    // digit only, never a full identifier.
    idMasked: `${idLetter}${int(1, 9)}${'*'.repeat(5)}(${int(0, 9)})`,
    name: tri(`${sn[0]} ${gn[0]}`, `${sn[1]}${gn[1]}`, `${sn[2]}${gn[2]}`),
    sex,
    dob: iso(dob),
    age,
    phone: chance(0.75) ? `+852 ${int(5, 9)}${int(100, 999)} ${int(1000, 9999)}` : `+86 1${int(30, 89)} ${int(1000, 9999)} ${int(1000, 9999)}`,
    district: tri(district.en, district.hant, district.hans),
    payerId: payer.id,
    bloodType: pick(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
    allergies: allergies.map((a) => tri(a.en, a.hant, a.hans)),
    conditions: conds.map((c) => ({ icd: c.icd, label: tri(c.en, c.hant, c.hans) })),
    primaryPhysicianId: primary.id,
    departmentId: conds[0].dept,
    status: chance(0.08) ? 'inpatient' : chance(0.12) ? 'inactive' : 'active',
    lastVisit: iso(lastVisit),
    // Composite acuity score — synthetic, used only to sort the worklist.
    acuity: Math.min(100, Math.round(age * 0.6 + nCond * 9 + (allergies.length ? 5 : 0) + int(0, 14))),
    consentResearch: chance(0.42),
    preferredLanguage: chance(0.55) ? 'zh-Hant' : chance(0.6) ? 'zh-Hans' : 'en',
  })
}

// ── Encounters ──────────────────────────────────────────────────────────────
const COMPLAINTS = [
  tri('Routine follow-up, stable', '例行覆診，情況穩定', '例行复诊，情况稳定'),
  tri('Exertional shortness of breath', '活動後氣促', '活动后气促'),
  tri('Bilateral ankle swelling', '雙踝水腫', '双踝水肿'),
  tri('Poor glycaemic control at home', '家居血糖控制欠佳', '家居血糖控制欠佳'),
  tri('Right knee pain on stairs', '上落樓梯時右膝痛', '上下楼梯时右膝痛'),
  tri('Dizziness on standing', '起身時頭暈', '起身时头晕'),
  tri('Persistent dry cough, 3 weeks', '持續乾咳三星期', '持续干咳三星期'),
  tri('Medication review requested', '要求檢視用藥', '要求检视用药'),
  tri('Fall at home, no loss of consciousness', '家中跌倒，無昏迷', '家中跌倒，无昏迷'),
  tri('Fatigue and reduced appetite', '疲倦及食慾下降', '疲倦及食欲下降'),
]
const PLANS = [
  tri('Continue current regimen. Review in 12 weeks.', '維持現有療程，十二週後覆診。', '维持现有疗程，十二周后复诊。'),
  tri('Titrate dose upward. Repeat bloods in 6 weeks.', '劑量上調，六週後重驗血。', '剂量上调，六周后复验血。'),
  tri('Refer to allied health for supervised exercise.', '轉介專職醫療接受監督運動訓練。', '转介专职医疗接受监督运动训练。'),
  tri('Arrange imaging; counsel on red-flag symptoms.', '安排影像檢查，講解警示徵狀。', '安排影像检查，讲解警示征状。'),
  tri('Admit for observation and IV therapy.', '入院觀察並接受靜脈治療。', '入院观察并接受静脉治疗。'),
  tri('Deprescribe one agent; monitor for rebound.', '減去一種藥物，監察反彈。', '减去一种药物，监察反弹。'),
]
const ENC_TYPES = ['outpatient', 'follow-up', 'inpatient', 'emergency', 'telehealth']

const encounters = []
let encN = 0
for (const p of patients) {
  const n = int(2, 6)
  for (let k = 0; k < n; k++) {
    const d = shift(-int(3, 620))
    const cond = pick(p.conditions)
    const sys = p.conditions.some((c) => c.icd === 'I10') ? int(132, 178) : int(108, 148)
    const dia = Math.round(sys * (0.55 + rnd() * 0.08))
    encN++
    encounters.push({
      id: `E${pad(encN, 5)}`,
      patientId: p.id,
      date: iso(d),
      type: chance(0.55) ? 'follow-up' : pick(ENC_TYPES),
      departmentId: p.departmentId,
      physicianId: pick(physicians.filter((x) => x.role === 'physician')).id,
      chiefComplaint: pick(COMPLAINTS),
      diagnosis: { icd: cond.icd, label: cond.label },
      plan: pick(PLANS),
      vitals: {
        bpSystolic: sys,
        bpDiastolic: dia,
        heartRate: int(52, 104),
        tempC: round(36.1 + rnd() * 1.3, 1),
        spo2: int(92, 99),
        weightKg: round(45 + rnd() * 42, 1),
        heightCm: int(148, 182),
      },
      durationMin: int(10, 45),
    })
  }
}
encounters.sort((a, b) => b.date.localeCompare(a.date))

// The registry's "last seen" date and the encounter list are the same fact shown
// twice. Derive one from the other so they can never disagree on screen.
for (const p of patients) {
  const mine = encounters.filter((e) => e.patientId === p.id)
  if (mine.length) p.lastVisit = mine.reduce((a, b) => (a.date > b.date ? a : b)).date
}

// ── Laboratory results ──────────────────────────────────────────────────────
function draw(ref, sex, dp, skewAbnormal) {
  const [lo, hi] = ref[sex]
  const l = lo ?? (hi * 0.35)
  const h = hi ?? (lo * 2.1)
  const span = h - l
  let v
  if (skewAbnormal) {
    v = chance(0.5) ? h + span * (0.05 + rnd() * 0.55) : Math.max(0, l - span * (0.05 + rnd() * 0.35))
  } else {
    v = l + span * (0.12 + rnd() * 0.76)
  }
  return round(v, dp)
}
function flagOf(v, ref, sex) {
  const [lo, hi] = ref[sex]
  if (hi !== null && v > hi) return v > hi * 1.5 ? 'critical-high' : 'high'
  if (lo !== null && v < lo) return v < lo * 0.6 ? 'critical-low' : 'low'
  return 'normal'
}

const labs = []
let labN = 0
for (const p of patients) {
  const relevant = LAB_PANELS.filter((pan) => {
    if (pan.panel === 'GLU') return p.conditions.some((c) => c.icd.startsWith('E11'))
    if (pan.panel === 'THY') return p.conditions.some((c) => c.icd.startsWith('E03'))
    if (pan.panel === 'LIPID') return p.conditions.some((c) => ['E78.5', 'I25.10', 'I10'].includes(c.icd))
    return true
  })
  const draws = int(2, 4)
  for (let d = 0; d < draws; d++) {
    const when = shift(-(d * int(70, 130) + int(4, 40)))
    for (const pan of relevant) {
      for (const a of pan.analytes) {
        const abnormal = chance(0.24)
        const v = draw(a.ref, p.sex, a.dp, abnormal)
        labN++
        labs.push({
          id: `L${pad(labN, 6)}`,
          patientId: p.id,
          date: iso(when),
          panel: pan.panel,
          panelName: tri(pan.en, pan.hant, pan.hans),
          code: a.code,
          analyte: tri(a.en, a.hant, a.hans),
          value: v,
          unit: a.unit,
          refLow: a.ref[p.sex][0],
          refHigh: a.ref[p.sex][1],
          flag: flagOf(v, a.ref, p.sex),
          // Provenance travels with the value. Without method + instrument, a
          // number from two labs cannot be compared — see project notes on 度量衡.
          method: pick(['Roche cobas 8000', 'Sysmex XN-1000', 'Abbott Architect c16000', 'Siemens Atellica CH']),
          performingLab: chance(0.8) ? tri('JevMed Central Laboratory', '傑醫中心化驗所', '杰医中心化验所')
                                     : tri('Partner Reference Laboratory', '夥伴參考化驗所', '伙伴参考化验所'),
        })
      }
    }
  }
}
labs.sort((a, b) => b.date.localeCompare(a.date))

// ── Medications ─────────────────────────────────────────────────────────────
const medications = []
let medN = 0
for (const p of patients) {
  const n = p.age > 70 ? int(3, 7) : int(1, 5)
  for (const d of shuffle(DRUGS).slice(0, n)) {
    const start = shift(-int(30, 900))
    const active = chance(0.78)
    medN++
    medications.push({
      id: `M${pad(medN, 5)}`,
      patientId: p.id,
      code: d.code,
      drug: tri(d.en, d.hant, d.hans),
      drugClass: d.cls,
      dose: d.dose,
      frequency: d.freq,
      route: d.route,
      startDate: iso(start),
      endDate: active ? null : iso(shift(-int(1, 29))),
      status: active ? 'active' : 'discontinued',
      prescriberId: p.primaryPhysicianId,
      refillsRemaining: active ? int(0, 5) : 0,
    })
  }
}

// ── Imaging ─────────────────────────────────────────────────────────────────
const FINDINGS = [
  tri('No acute cardiopulmonary abnormality.', '無急性心肺異常。', '无急性心肺异常。'),
  tri('Mild cardiomegaly. Clear lung fields.', '輕度心臟擴大，肺野清晰。', '轻度心脏扩大，肺野清晰。'),
  tri('Degenerative change, no acute fracture.', '退化性改變，無急性骨折。', '退化性改变，无急性骨折。'),
  tri('Small pleural effusion, right base.', '右肺底少量胸腔積液。', '右肺底少量胸腔积液。'),
  tri('Stable since prior study. No interval change.', '與前次檢查比較穩定，無變化。', '与前次检查比较稳定，无变化。'),
  tri('Preserved ejection fraction, grade I diastolic dysfunction.', '射血分數正常，一級舒張功能障礙。', '射血分数正常，一级舒张功能障碍。'),
  tri('T-score -2.7 at femoral neck, consistent with osteoporosis.', '股骨頸T值-2.7，符合骨質疏鬆。', '股骨颈T值-2.7，符合骨质疏松。'),
]
const imaging = []
let imgN = 0
for (const p of patients) {
  if (!chance(0.72)) continue
  for (let k = 0; k < int(1, 3); k++) {
    const s = pick(IMAGING)
    imgN++
    imaging.push({
      id: `R${pad(imgN, 5)}`,
      patientId: p.id,
      date: iso(shift(-int(6, 500))),
      modality: s.mod,
      study: tri(s.en, s.hant, s.hans),
      bodyPart: s.part,
      findings: pick(FINDINGS),
      radiologistId: 'S009',
      status: chance(0.88) ? 'finalised' : 'preliminary',
      accession: `ACC${int(100000, 999999)}`,
    })
  }
}
imaging.sort((a, b) => b.date.localeCompare(a.date))

// ── Appointments ────────────────────────────────────────────────────────────
const ROOMS = ['Clinic 2A', 'Clinic 2B', 'Clinic 3C', 'Day Ward 1', 'Procedure Rm 4', 'Telehealth']
const appointments = []
let apN = 0
for (let d = -3; d <= 18; d++) {
  const per = d < 0 ? int(2, 4) : int(3, 7)
  for (let k = 0; k < per; k++) {
    const p = pick(patients)
    const when = shift(d)
    const hour = int(9, 17)
    const min = pick([0, 15, 30, 45])
    apN++
    const past = d < 0
    appointments.push({
      id: `A${pad(apN, 5)}`,
      patientId: p.id,
      datetime: `${iso(when)} ${pad(hour, 2)}:${pad(min, 2)}`,
      departmentId: p.departmentId,
      physicianId: p.primaryPhysicianId,
      room: pick(ROOMS),
      type: pick(['follow-up', 'new-referral', 'procedure', 'lab-draw', 'telehealth']),
      status: past ? pick(['completed', 'completed', 'completed', 'no-show']) 
                   : (d === 0 ? pick(['checked-in', 'scheduled', 'scheduled']) : 'scheduled'),
      interpreterNeeded: chance(0.14),
      notes: null,
    })
  }
}
appointments.sort((a, b) => a.datetime.localeCompare(b.datetime))

// ── Billing & claims ────────────────────────────────────────────────────────
const CHARGE_ITEMS = [
  { code: 'CONS-SP', en: 'Specialist consultation', hant: '專科診症', hans: '专科诊症', unit: 980 },
  { code: 'CONS-FU', en: 'Follow-up consultation', hant: '覆診', hans: '复诊', unit: 560 },
  { code: 'LAB-CBC', en: 'Complete blood count', hant: '全血細胞計數', hans: '全血细胞计数', unit: 230 },
  { code: 'LAB-RFT', en: 'Renal function panel', hant: '腎功能組合', hans: '肾功能组合', unit: 410 },
  { code: 'LAB-A1C', en: 'HbA1c', hant: '糖化血紅蛋白', hans: '糖化血红蛋白', unit: 320 },
  { code: 'IMG-XR',  en: 'Plain radiograph', hant: '平片X光', hans: '平片X光', unit: 690 },
  { code: 'IMG-CT',  en: 'CT with contrast', hant: '電腦掃描（造影）', hans: '电脑断层（造影）', unit: 5800 },
  { code: 'IMG-US',  en: 'Ultrasound study', hant: '超聲波檢查', hans: '超声检查', unit: 1450 },
  { code: 'PHAR-D',  en: 'Dispensed medication', hant: '配發藥物', hans: '配发药物', unit: 340 },
  { code: 'NURS-INJ',en: 'Nurse-administered injection', hant: '護士注射', hans: '护士注射', unit: 180 },
  { code: 'DAY-OBS', en: 'Day-ward observation', hant: '日間病房觀察', hans: '日间病房观察', unit: 2400 },
]
const CLAIM_STATES = ['paid', 'paid', 'paid', 'submitted', 'adjudicating', 'partially-paid', 'rejected', 'draft']
const REJECT_REASONS = [
  tri('Pre-authorisation reference missing', '缺少預先批核編號', '缺少预先批核编号'),
  tri('Item not covered under plan tier', '項目不屬計劃保障範圍', '项目不属计划保障范围'),
  tri('Duplicate submission detected', '偵測到重複遞交', '侦测到重复递交'),
  tri('Diagnosis code inconsistent with service', '診斷編碼與服務不符', '诊断编码与服务不符'),
]

const invoices = []
let invN = 0
for (let k = 0; k < 64; k++) {
  const p = pick(patients)
  const payer = PAYERS.find((x) => x.id === p.payerId)
  const lines = shuffle(CHARGE_ITEMS).slice(0, int(2, 5)).map((c) => {
    const qty = int(1, 2)
    return { code: c.code, label: tri(c.en, c.hant, c.hans), qty, unitPrice: c.unit, amount: qty * c.unit }
  })
  const gross = lines.reduce((s, l) => s + l.amount, 0)
  const isSelfPay = payer.id === 'SELF'
  const state = isSelfPay ? pick(['paid', 'paid', 'outstanding']) : pick(CLAIM_STATES)
  const covered = isSelfPay ? 0
    : state === 'paid' ? gross
    : state === 'partially-paid' ? Math.round(gross * (0.4 + rnd() * 0.35))
    : 0
  invN++
  invoices.push({
    id: `INV-${2026}-${pad(invN, 4)}`,
    patientId: p.id,
    date: iso(shift(-int(1, 150))),
    payerId: payer.id,
    lines,
    grossAmount: gross,
    coveredAmount: covered,
    patientResponsibility: gross - covered,
    currency: 'HKD',
    claimStatus: state,
    claimRef: isSelfPay ? null : `CLM${int(100000, 999999)}`,
    rejectionReason: state === 'rejected' ? pick(REJECT_REASONS) : null,
    daysOutstanding: ['paid'].includes(state) ? 0 : int(3, 96),
  })
}
invoices.sort((a, b) => b.date.localeCompare(a.date))

// ── Inventory ───────────────────────────────────────────────────────────────
const INV_SPEC = [
  ...DRUGS.map((d) => ({ cat: 'pharmaceutical', en: `${d.en} ${d.dose}`, hant: `${d.hant} ${d.dose}`, hans: `${d.hans} ${d.dose}`, unit: 'box (30)' })),
  { cat: 'consumable', en: 'Nitrile examination gloves, M', hant: '丁腈檢查手套（中）', hans: '丁腈检查手套（中）', unit: 'box (100)' },
  { cat: 'consumable', en: 'Surgical mask, ASTM Level 2', hant: '外科口罩 ASTM 2級', hans: '外科口罩 ASTM 2级', unit: 'box (50)' },
  { cat: 'consumable', en: 'IV cannula 20G', hant: '靜脈留置針 20G', hans: '静脉留置针 20G', unit: 'pack (50)' },
  { cat: 'consumable', en: 'Sterile dressing pack', hant: '無菌敷料包', hans: '无菌敷料包', unit: 'each' },
  { cat: 'consumable', en: 'Blood collection tube, EDTA', hant: 'EDTA採血管', hans: 'EDTA采血管', unit: 'pack (100)' },
  { cat: 'reagent', en: 'HbA1c assay cartridge', hant: '糖化血紅蛋白試劑匣', hans: '糖化血红蛋白试剂匣', unit: 'kit (200)' },
  { cat: 'reagent', en: 'Creatinine enzymatic reagent', hant: '肌酸酐酶法試劑', hans: '肌酐酶法试剂', unit: 'kit (400)' },
  { cat: 'reagent', en: 'Troponin-I immunoassay kit', hant: '肌鈣蛋白I免疫試劑', hans: '肌钙蛋白I免疫试剂', unit: 'kit (100)' },
  { cat: 'reagent', en: 'Iodinated contrast, 350 mgI/mL', hant: '碘造影劑 350 mgI/mL', hans: '碘造影剂 350 mgI/mL', unit: 'bottle (100 mL)' },
  { cat: 'device', en: 'Digital sphygmomanometer', hant: '電子血壓計', hans: '电子血压计', unit: 'each' },
  { cat: 'device', en: 'Pulse oximeter, fingertip', hant: '指夾式血氧儀', hans: '指夹式血氧仪', unit: 'each' },
  { cat: 'device', en: 'Nebuliser mask set, adult', hant: '成人霧化面罩套裝', hans: '成人雾化面罩套装', unit: 'each' },
  { cat: 'device', en: 'Infusion pump giving set', hant: '輸液泵管路', hans: '输液泵管路', unit: 'each' },
]
const SUPPLIERS = [
  tri('Zuellig Pharma HK', '裕利醫藥香港', '裕利医药香港'),
  tri('DKSH Hong Kong', '大昌華嘉香港', '大昌华嘉香港'),
  tri('Sinopharm Guangdong', '國藥控股廣東', '国药控股广东'),
  tri('Shanghai Pharma Distribution', '上藥分銷', '上药分销'),
  tri('Medline International', '美德樂國際', '美德乐国际'),
]
const inventory = INV_SPEC.map((s, i) => {
  const reorder = int(8, 45)
  const onHand = chance(0.2) ? int(0, reorder) : int(reorder + 1, reorder * 6)
  const expiry = shift(int(-20, 700))
  return {
    sku: `SKU-${pad(1000 + i, 4)}`,
    name: tri(s.en, s.hant, s.hans),
    category: s.cat,
    unit: s.unit,
    onHand,
    reorderPoint: reorder,
    onOrder: onHand <= reorder ? int(20, 120) : 0,
    lot: `LOT${int(10000, 99999)}`,
    expiry: iso(expiry),
    // GTIN identifies the product class; the lot is what identifies THIS batch.
    gtin: `0${int(4000000000000, 4999999999999)}`,
    supplier: pick(SUPPLIERS),
    unitCostHKD: round(8 + rnd() * 940, 2),
    storage: s.cat === 'reagent' ? '2–8 °C' : chance(0.15) ? '2–8 °C' : 'Room temp',
    controlled: s.cat === 'pharmaceutical' && chance(0.12),
  }
})

// ── Audit log ───────────────────────────────────────────────────────────────
const AUDIT_ACTIONS = [
  ['view',   'patient'], ['view', 'patient'], ['view', 'patient'],
  ['export', 'report'],  ['amend', 'encounter'], ['create', 'appointment'],
  ['dispense', 'medication'], ['submit', 'claim'], ['adjust', 'inventory'],
  ['login', 'session'], ['failed-login', 'session'], ['view', 'lab-result'],
  ['print', 'patient-summary'], ['ai-query', 'assistant'],
]
const auditLog = []
for (let i = 0; i < 140; i++) {
  const [action, entity] = pick(AUDIT_ACTIONS)
  const actor = pick(staff)
  const t = new Date(TODAY.getTime() - int(0, 14) * dayMs - int(0, 86399) * 1000)
  auditLog.push({
    id: `AU${pad(i + 1, 5)}`,
    timestamp: isoT(t),
    actorId: actor.id,
    actorRole: actor.role,
    action,
    entity,
    entityId: entity === 'patient' ? pick(patients).id
            : entity === 'claim' ? pick(invoices).id
            : entity === 'inventory' ? pick(inventory).sku
            : '—',
    ip: `10.${int(0, 4)}.${int(1, 240)}.${int(2, 250)}`,
    result: action === 'failed-login' ? 'denied' : 'permitted',
    // A real deployment records the stated purpose of access. Recording it is
    // what makes an audit trail reviewable rather than merely voluminous.
    purpose: pick(['direct care', 'direct care', 'direct care', 'billing', 'quality review', 'system administration']),
  })
}
auditLog.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

// ── Roster ──────────────────────────────────────────────────────────────────
const roster = []
for (let d = 0; d <= 13; d++) {
  for (const shiftName of ['day', 'evening', 'night']) {
    const pool = shuffle(staff.filter((s) => s.status === 'active'))
    roster.push({
      date: iso(shift(d)),
      shift: shiftName,
      staffIds: pool.slice(0, shiftName === 'night' ? 3 : int(5, 8)).map((s) => s.id),
      onCallId: pool[0].id,
    })
  }
}

// ── Assemble ────────────────────────────────────────────────────────────────
const bundle = {
  meta: {
    generatedFor: 'JevMed ERP demonstration',
    generatedAt: iso(TODAY),
    seed: 20260922,
    synthetic: true,
    notice: tri(
      'All records in this system are synthetic. No real person is represented.',
      '本系統內所有記錄均為模擬資料，不涉及任何真實人士。',
      '本系统内所有记录均为模拟资料，不涉及任何真实人士。',
    ),
  },
  departments: DEPARTMENTS.map((d) => ({ id: d.id, name: tri(d.en, d.hant, d.hans) })),
  payers: PAYERS.map((p) => ({ id: p.id, name: tri(p.en, p.hant, p.hans) })),
  staff, patients, encounters, labs, medications, imaging,
  appointments, invoices, inventory, roster, auditLog,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(bundle))
const kb = (JSON.stringify(bundle).length / 1024).toFixed(0)
console.log(`✓ mock data written → src/data/mock.json  (${kb} KB)`)
for (const [k, v] of Object.entries(bundle)) {
  if (Array.isArray(v)) console.log(`   ${k.padEnd(14)} ${v.length}`)
}
