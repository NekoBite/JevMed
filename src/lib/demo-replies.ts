/**
 * Demonstration-mode answers.
 *
 * When no API key is stored, the assistant still answers — but from the data
 * directly, computed here, rather than from a language model. That is a
 * deliberate choice over canned paragraphs: a board member trying the system
 * before a key is purchased should see real answers about the record in front
 * of them, clearly labelled as demonstration output.
 *
 * These answers do arithmetic and lookups. They do not attempt open-ended
 * questions; for anything outside the prepared set, the assistant says so.
 */
import {
  getPatient, latestLabPanel, medsFor, staffById, db,
  rejectedClaims, stockState, daysUntil, todaysAppointments, TODAY,
} from './data'
import { pickTri } from '@/i18n'
import type { Lang } from './types'

export type DemoTopic =
  | 'summary' | 'abnormal' | 'interactions' | 'nextVisit'
  | 'rejectedClaims' | 'restock' | 'apptLoad'

const P = <T extends Record<Lang, string>>(x: T) => x

// ── Phrase table ────────────────────────────────────────────────────────────
const S = {
  demoNote: P({
    en: '_Demonstration mode: this answer was computed directly from the records in this system, not by a language model. Connect an API key in the key management console for open-ended questions._',
    'zh-Hant': '_示範模式：此回覆由本系統紀錄直接計算得出，並非語言模型生成。如需回答開放式問題，請在密鑰管理主控台連接 API 密鑰。_',
    'zh-Hans': '_演示模式：此回复由本系统记录直接计算得出，并非语言模型生成。如需回答开放式问题，请在密钥管理控制台连接 API 密钥。_',
  }),
  noPatient: P({
    en: 'No patient record is open, so there is nothing to summarise. Open a record from the patient registry first.',
    'zh-Hant': '目前沒有開啟任何病人紀錄，無法作出摘要。請先從病人登記冊開啟紀錄。',
    'zh-Hans': '目前没有打开任何患者记录，无法作出摘要。请先从患者登记册打开记录。',
  }),
  unknown: P({
    en: 'I can only answer the prepared questions while the assistant is in demonstration mode. Use one of the suggestions below, or ask an administrator to add an API key in the key management console.',
    'zh-Hant': '助理現處於示範模式，只能回答預設問題。請使用下方建議，或請管理員在密鑰管理主控台加入 API 密鑰。',
    'zh-Hans': '助手现处于演示模式，只能回答预设问题。请使用下方建议，或请管理员在密钥管理控制台添加 API 密钥。',
  }),
  years: P({ en: 'years old', 'zh-Hant': '歲', 'zh-Hans': '岁' }),
  male: P({ en: 'male', 'zh-Hant': '男性', 'zh-Hans': '男性' }),
  female: P({ en: 'female', 'zh-Hant': '女性', 'zh-Hans': '女性' }),
}

const tx = (lang: Lang, m: Record<Lang, string>) => m[lang] ?? m.en

/** Real, well-documented pairings. Kept short and defensible on purpose. */
const INTERACTIONS: { a: string; b: string; note: Record<Lang, string> }[] = [
  { a: 'WARF', b: 'ASPI', note: P({
    en: 'Warfarin with aspirin raises bleeding risk substantially. Confirm the indication for both and review INR monitoring.',
    'zh-Hant': '華法林與阿士匹靈併用會明顯增加出血風險。請確認兩者的用藥指徵，並檢視 INR 監測安排。',
    'zh-Hans': '华法林与阿司匹林合用会明显增加出血风险。请确认两者的用药指征，并检视 INR 监测安排。' }) },
  { a: 'WARF', b: 'CLOP', note: P({
    en: 'Warfarin with clopidogrel raises bleeding risk. Triple therapy should be time-limited and documented.',
    'zh-Hant': '華法林與氯吡格雷併用會增加出血風險。三聯抗栓治療應限期使用並有文件記錄。',
    'zh-Hans': '华法林与氯吡格雷合用会增加出血风险。三联抗栓治疗应限期使用并有文件记录。' }) },
  { a: 'ASPI', b: 'CLOP', note: P({
    en: 'Dual antiplatelet therapy. Appropriate after stenting, but the intended duration should be recorded.',
    'zh-Hant': '雙重抗血小板治療。支架術後屬合理，但應記錄預計療程長度。',
    'zh-Hans': '双重抗血小板治疗。支架术后属合理，但应记录预计疗程长度。' }) },
  { a: 'OMEP', b: 'CLOP', note: P({
    en: 'Omeprazole inhibits CYP2C19 and can reduce the activation of clopidogrel. Pantoprazole is the usual alternative.',
    'zh-Hant': '奧美拉唑抑制 CYP2C19，可能減弱氯吡格雷的活化。一般會改用泮托拉唑。',
    'zh-Hans': '奥美拉唑抑制 CYP2C19，可能减弱氯吡格雷的活化。一般会改用泮托拉唑。' }) },
  { a: 'GLIC', b: 'GLAR', note: P({
    en: 'A sulfonylurea alongside basal insulin carries a real hypoglycaemia risk, particularly in an older patient.',
    'zh-Hant': '磺脲類藥物與基礎胰島素併用有明確低血糖風險，長者尤甚。',
    'zh-Hans': '磺脲类药物与基础胰岛素合用有明确低血糖风险，老年患者尤甚。' }) },
  { a: 'EMPA', b: 'FURO', note: P({
    en: 'An SGLT2 inhibitor with a loop diuretic can cause volume depletion. Watch renal function and postural symptoms.',
    'zh-Hant': 'SGLT2 抑制劑與袢利尿劑併用可致血容量不足，須監察腎功能及體位性症狀。',
    'zh-Hans': 'SGLT2 抑制剂与袢利尿剂合用可致血容量不足，须监测肾功能及体位性症状。' }) },
  { a: 'LISI', b: 'FURO', note: P({
    en: 'An ACE inhibitor with a loop diuretic can drop blood pressure and worsen renal function, especially after a dose change.',
    'zh-Hant': 'ACE 抑制劑與袢利尿劑併用可令血壓下降並影響腎功能，調整劑量後尤須注意。',
    'zh-Hans': 'ACE 抑制剂与袢利尿剂合用可令血压下降并影响肾功能，调整剂量后尤须注意。' }) },
  { a: 'BISO', b: 'FURO', note: P({
    en: 'A beta blocker with a diuretic can cause symptomatic hypotension in a frail patient.',
    'zh-Hant': 'β受體阻斷劑與利尿劑併用，體弱病人可出現症狀性低血壓。',
    'zh-Hans': 'β受体阻滞剂与利尿剂合用，体弱患者可出现症状性低血压。' }) },
]

// ── Answer builders ─────────────────────────────────────────────────────────

function summary(lang: Lang, patientId: string | null): string {
  if (!patientId) return tx(lang, S.noPatient)
  const p = getPatient(patientId)
  if (!p) return tx(lang, S.noPatient)

  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const doc = staffById.get(p.primaryPhysicianId)
  const meds = medsFor(p.id).filter((m) => m.status === 'active')
  const labs = latestLabPanel(p.id)
  const abnormal = labs.filter((l) => l.flag !== 'normal')
  const sex = p.sex === 'M' ? tx(lang, S.male) : tx(lang, S.female)

  if (lang === 'en') {
    return [
      `**${E(p.name)}** is ${p.age} ${tx(lang, S.years)}, ${sex}, file ${p.mrn}, under ${doc ? E(doc.name) : 'no assigned physician'}.`,
      '',
      `The active problem list has ${p.conditions.length} entr${p.conditions.length === 1 ? 'y' : 'ies'}: ${p.conditions.map((c) => E(c.label)).join(', ')}.`,
      p.allergies.length
        ? `Allergies are recorded to ${p.allergies.map(E).join(' and ')}.`
        : 'No drug allergy is recorded.',
      '',
      `${meds.length} medication${meds.length === 1 ? ' is' : 's are'} currently active${meds.length >= 5 ? ', which is enough to warrant a structured medication review' : ''}.`,
      abnormal.length
        ? `Of the ${labs.length} most recent laboratory values, ${abnormal.length} sit outside the reference interval — the largest being ${E(abnormal[0].analyte)} at ${abnormal[0].value} ${abnormal[0].unit}.`
        : `All ${labs.length} of the most recent laboratory values sit within their reference intervals.`,
      '',
      `Last seen ${p.lastVisit}. Secondary-use consent is ${p.consentResearch ? 'given' : 'withheld'}.`,
    ].join('\n')
  }

  if (lang === 'zh-Hant') {
    return [
      `**${E(p.name)}**，${p.age}${tx(lang, S.years)}，${sex}，檔案編號 ${p.mrn}，主診醫生為${doc ? E(doc.name) : '未指定'}。`,
      '',
      `現存問題共 ${p.conditions.length} 項：${p.conditions.map((c) => E(c.label)).join('、')}。`,
      p.allergies.length ? `已記錄對${p.allergies.map(E).join('、')}過敏。` : '沒有已知藥物過敏紀錄。',
      '',
      `現時使用中的藥物共 ${meds.length} 種${meds.length >= 5 ? '，數目已足以建議進行結構性用藥檢視' : ''}。`,
      abnormal.length
        ? `最近 ${labs.length} 項化驗結果中，有 ${abnormal.length} 項超出參考範圍，其中最顯著的是${E(abnormal[0].analyte)}（${abnormal[0].value} ${abnormal[0].unit}）。`
        : `最近 ${labs.length} 項化驗結果全部在參考範圍之內。`,
      '',
      `最後就診日期為 ${p.lastVisit}。次要用途同意：${p.consentResearch ? '已同意' : '未同意'}。`,
    ].join('\n')
  }

  return [
    `**${E(p.name)}**，${p.age}${tx(lang, S.years)}，${sex}，病案号 ${p.mrn}，主诊医师为${doc ? E(doc.name) : '未指定'}。`,
    '',
    `现存问题共 ${p.conditions.length} 项：${p.conditions.map((c) => E(c.label)).join('、')}。`,
    p.allergies.length ? `已记录对${p.allergies.map(E).join('、')}过敏。` : '无已知药物过敏记录。',
    '',
    `目前在用药品共 ${meds.length} 种${meds.length >= 5 ? '，数量已足以建议开展结构化用药审核' : ''}。`,
    abnormal.length
      ? `最近 ${labs.length} 项检验结果中，有 ${abnormal.length} 项超出参考区间，其中最显著的是${E(abnormal[0].analyte)}（${abnormal[0].value} ${abnormal[0].unit}）。`
      : `最近 ${labs.length} 项检验结果全部在参考区间之内。`,
    '',
    `最近就诊日期为 ${p.lastVisit}。二次利用知情同意：${p.consentResearch ? '已同意' : '未同意'}。`,
  ].join('\n')
}

function abnormalLabs(lang: Lang, patientId: string | null): string {
  if (!patientId) return tx(lang, S.noPatient)
  const p = getPatient(patientId)
  if (!p) return tx(lang, S.noPatient)
  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const labs = latestLabPanel(p.id)
  const out = labs.filter((l) => l.flag !== 'normal')

  const head = {
    en: out.length
      ? `${out.length} of ${labs.length} current values sit outside their reference interval.`
      : `All ${labs.length} current values sit within their reference intervals.`,
    'zh-Hant': out.length
      ? `${labs.length} 項最新化驗結果中，有 ${out.length} 項超出參考範圍。`
      : `${labs.length} 項最新化驗結果全部在參考範圍之內。`,
    'zh-Hans': out.length
      ? `${labs.length} 项最新检验结果中，有 ${out.length} 项超出参考区间。`
      : `${labs.length} 项最新检验结果全部在参考区间之内。`,
  }[lang]

  const flagWord: Record<string, Record<Lang, string>> = {
    high: P({ en: 'high', 'zh-Hant': '偏高', 'zh-Hans': '偏高' }),
    low: P({ en: 'low', 'zh-Hant': '偏低', 'zh-Hans': '偏低' }),
    'critical-high': P({ en: 'CRITICALLY HIGH', 'zh-Hant': '危急偏高', 'zh-Hans': '危急值（高）' }),
    'critical-low': P({ en: 'CRITICALLY LOW', 'zh-Hant': '危急偏低', 'zh-Hans': '危急值（低）' }),
  }

  const lines = out.map((l) => {
    const ref = l.refLow !== null && l.refHigh !== null ? `${l.refLow}–${l.refHigh}`
      : l.refHigh !== null ? `< ${l.refHigh}` : `> ${l.refLow}`
    return `- **${E(l.analyte)}** — ${l.value} ${l.unit} (${tx(lang, flagWord[l.flag])}; ${ref}) · ${l.date} · ${l.method}`
  })

  const tail = {
    en: 'Values produced by different methods or instruments are not directly comparable; the method is shown against each result for that reason.',
    'zh-Hant': '不同方法或儀器所得的數值不可直接比較，因此每項結果均列明化驗方法。',
    'zh-Hans': '不同方法或仪器所得的数值不可直接比较，因此每项结果均列明检验方法。',
  }[lang]

  return [head, '', ...lines, '', tail].filter(Boolean).join('\n')
}

function interactions(lang: Lang, patientId: string | null): string {
  if (!patientId) return tx(lang, S.noPatient)
  const p = getPatient(patientId)
  if (!p) return tx(lang, S.noPatient)
  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const active = medsFor(p.id).filter((m) => m.status === 'active')
  const codes = new Set(active.map((m) => m.code))
  const hits = INTERACTIONS.filter((r) => codes.has(r.a) && codes.has(r.b))

  const head = {
    en: `${active.length} active medication${active.length === 1 ? '' : 's'}: ${active.map((m) => `${E(m.drug)} ${m.dose} ${m.frequency}`).join('; ')}.`,
    'zh-Hant': `現時使用中藥物 ${active.length} 種：${active.map((m) => `${E(m.drug)} ${m.dose} ${m.frequency}`).join('；')}。`,
    'zh-Hans': `目前在用药品 ${active.length} 种：${active.map((m) => `${E(m.drug)} ${m.dose} ${m.frequency}`).join('；')}。`,
  }[lang]

  const none = {
    en: 'No pairing in the checked set raises a flag. This check covers a short list of well-documented interactions only — it is not a substitute for a full pharmacist review.',
    'zh-Hant': '在已檢查的組合中沒有發現須注意的配對。本檢查只涵蓋少數文獻充分的相互作用，不能取代藥劑師的完整檢視。',
    'zh-Hans': '在已检查的组合中未发现须注意的配对。本检查仅涵盖少数文献充分的相互作用，不能取代药师的完整审核。',
  }[lang]

  const poly = active.length >= 5 ? {
    en: `\nWith ${active.length} concurrent agents, a structured medication review is warranted on count alone.`,
    'zh-Hant': `\n同時使用 ${active.length} 種藥物，單就數目已值得安排結構性用藥檢視。`,
    'zh-Hans': `\n同时使用 ${active.length} 种药品，单就数量已值得安排结构化用药审核。`,
  }[lang] : ''

  if (hits.length === 0) return [head, '', none, poly].join('\n')
  return [head, '', ...hits.map((h) => `- ${tx(lang, h.note)}`), poly].join('\n')
}

function nextVisit(lang: Lang, patientId: string | null): string {
  if (!patientId) return tx(lang, S.noPatient)
  const p = getPatient(patientId)
  if (!p) return tx(lang, S.noPatient)
  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const abnormal = latestLabPanel(p.id).filter((l) => l.flag !== 'normal')
  const active = medsFor(p.id).filter((m) => m.status === 'active')

  const items: string[] = []
  const add = (m: Record<Lang, string>) => items.push(`- ${tx(lang, m)}`)

  for (const l of abnormal.slice(0, 3)) {
    add(P({
      en: `Repeat ${E(l.analyte)} — last value ${l.value} ${l.unit} on ${l.date} was outside the reference interval.`,
      'zh-Hant': `重驗${E(l.analyte)}——${l.date} 的數值 ${l.value} ${l.unit} 超出參考範圍。`,
      'zh-Hans': `复查${E(l.analyte)}——${l.date} 的数值 ${l.value} ${l.unit} 超出参考区间。`,
    }))
  }
  if (active.length >= 5) {
    add(P({
      en: `Review all ${active.length} active medications for anything that can be stopped.`,
      'zh-Hant': `檢視全部 ${active.length} 種現用藥物，考慮可否停用其中一些。`,
      'zh-Hans': `审核全部 ${active.length} 种在用药品，考虑可否停用其中一些。`,
    }))
  }
  if (p.age >= 75) {
    add(P({
      en: 'Ask about falls, dizziness on standing and any change in memory since the last visit.',
      'zh-Hant': '詢問有否跌倒、起身時頭暈，以及上次覆診後記憶力有否變化。',
      'zh-Hans': '询问有无跌倒、起身时头晕，以及上次复诊后记忆力有无变化。',
    }))
  }
  if (p.allergies.length) {
    add(P({
      en: `Confirm the recorded allergies still hold: ${p.allergies.map(E).join(', ')}.`,
      'zh-Hant': `確認已記錄的過敏史是否仍然適用：${p.allergies.map(E).join('、')}。`,
      'zh-Hans': `确认已记录的过敏史是否仍然适用：${p.allergies.map(E).join('、')}。`,
    }))
  }
  add(P({
    en: 'Confirm adherence in the patient’s own words rather than asking whether they are taking the tablets.',
    'zh-Hant': '請病人以自己的說法描述服藥情況，而非只問「有沒有依時食藥」。',
    'zh-Hans': '请患者以自己的说法描述服药情况，而非只问"有没有按时吃药"。',
  }))

  const head = {
    en: `Points worth raising at the next visit for ${E(p.name)}:`,
    'zh-Hant': `${E(p.name)}下次覆診值得提出的要點：`,
    'zh-Hans': `${E(p.name)}下次复诊值得提出的要点：`,
  }[lang]

  return [head, '', ...items].join('\n')
}

function rejected(lang: Lang): string {
  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const rows = rejectedClaims()
  if (rows.length === 0) {
    return { en: 'No claims are currently in a rejected state.',
      'zh-Hant': '目前沒有被拒的索償。', 'zh-Hans': '目前没有被拒的理赔。' }[lang]
  }
  const head = {
    en: `${rows.length} claim${rows.length === 1 ? ' is' : 's are'} currently rejected, totalling ${Math.round(rows.reduce((s, r) => s + r.grossAmount, 0)).toLocaleString()} HKD.`,
    'zh-Hant': `目前有 ${rows.length} 宗索償被拒，涉及金額 ${Math.round(rows.reduce((s, r) => s + r.grossAmount, 0)).toLocaleString()} 港元。`,
    'zh-Hans': `目前有 ${rows.length} 笔理赔被拒，涉及金额 ${Math.round(rows.reduce((s, r) => s + r.grossAmount, 0)).toLocaleString()} 港元。`,
  }[lang]
  const lines = rows.map((r) =>
    `- **${r.id}** · ${r.date} · ${Math.round(r.grossAmount).toLocaleString()} HKD — ${r.rejectionReason ? E(r.rejectionReason) : '—'}`)
  return [head, '', ...lines].join('\n')
}

function restock(lang: Lang): string {
  const E = (v: Parameters<typeof pickTri>[1]) => pickTri(lang, v)
  const rows = db.inventory
    .map((i) => ({ i, s: stockState(i) }))
    .filter(({ s }) => s !== 'ok')
    .sort((a, b) => a.i.expiry.localeCompare(b.i.expiry))
  if (rows.length === 0) {
    return { en: 'Every stock line is above its reorder point and none expires within 90 days.',
      'zh-Hant': '所有存貨項目均高於再訂貨點，且九十日內沒有到期項目。',
      'zh-Hans': '所有库存条目均高于再订货点，且九十天内没有到期条目。' }[lang]
  }
  const label: Record<string, Record<Lang, string>> = {
    expired: P({ en: 'EXPIRED', 'zh-Hant': '已過期', 'zh-Hans': '已过期' }),
    out: P({ en: 'out of stock', 'zh-Hant': '缺貨', 'zh-Hans': '缺货' }),
    expiring: P({ en: 'expiring soon', 'zh-Hant': '即將到期', 'zh-Hans': '临近效期' }),
    low: P({ en: 'at reorder point', 'zh-Hant': '已達再訂貨點', 'zh-Hans': '已达再订货点' }),
  }
  const head = {
    en: `${rows.length} stock line${rows.length === 1 ? '' : 's'} need attention:`,
    'zh-Hant': `有 ${rows.length} 項存貨需要處理：`,
    'zh-Hans': `有 ${rows.length} 项库存需要处理：`,
  }[lang]
  const lines = rows.map(({ i, s }) =>
    `- **${E(i.name)}** (${i.sku}) — ${tx(lang, label[s])} · ${i.onHand}/${i.reorderPoint} · lot ${i.lot} · ${i.expiry} (${daysUntil(i.expiry)}d) · ${E(i.supplier)}`)
  return [head, '', ...lines].join('\n')
}

function apptLoad(lang: Lang): string {
  const today = todaysAppointments()
  const week = db.appointments.filter((a) => {
    const d = a.datetime.slice(0, 10)
    return d >= TODAY && daysUntil(d) <= 7
  })
  const interp = week.filter((a) => a.interpreterNeeded).length
  const noShow = db.appointments.filter((a) => a.status === 'no-show').length
  return {
    en: `There are ${today.length} appointments today and ${week.length} across the next seven days. ${interp} of those need an interpreter. Across the recorded history, ${noShow} appointments were marked as did-not-attend.`,
    'zh-Hant': `今日有 ${today.length} 個預約，未來七日共 ${week.length} 個，其中 ${interp} 個需要傳譯。在已記錄的資料中，共有 ${noShow} 個預約被標示為爽約。`,
    'zh-Hans': `今日有 ${today.length} 个预约，未来七天共 ${week.length} 个，其中 ${interp} 个需要翻译。在已记录的数据中，共有 ${noShow} 个预约被标记为未到诊。`,
  }[lang]
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function demoReply(topic: DemoTopic | null, lang: Lang, patientId: string | null): string {
  const body = (() => {
    switch (topic) {
      case 'summary': return summary(lang, patientId)
      case 'abnormal': return abnormalLabs(lang, patientId)
      case 'interactions': return interactions(lang, patientId)
      case 'nextVisit': return nextVisit(lang, patientId)
      case 'rejectedClaims': return rejected(lang)
      case 'restock': return restock(lang)
      case 'apptLoad': return apptLoad(lang)
      default: return tx(lang, S.unknown)
    }
  })()
  return `${body}\n\n${tx(lang, S.demoNote)}`
}
