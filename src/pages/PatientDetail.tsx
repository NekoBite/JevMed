import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { useAssistant } from '@/lib/assistant-context'
import {
  Card, CardHeader, Chip, DefRow, TableFrame, Tabs, TabPanel,
  EmptyState, Banner, PageHeading, StatusDot,
} from '@/components/ui'
import { Sparkline } from '@/components/Charts'
import {
  getPatient, staffById, departmentsById, payersById, encountersFor,
  latestLabPanel, labSeries, medsFor, imagingFor, invoicesFor,
  latestEncounter, bmi,
} from '@/lib/data'
import { canOpenPatientRecord, canUseAssistant } from '@/lib/roles'
import { longDate, shortDate, money, refRange, num } from '@/lib/format'
import type { MsgKey } from '@/i18n'
import type { Tone } from '@/components/ui'
import type { LabFlag, ClaimStatus } from '@/lib/types'

const FLAG_TONE: Record<LabFlag, 'ok' | 'warn' | 'danger'> = {
  normal: 'ok', low: 'warn', high: 'warn',
  'critical-low': 'danger', 'critical-high': 'danger',
}

export const CLAIM_TONE: Record<ClaimStatus, 'ok' | 'warn' | 'danger' | 'neutral' | 'info'> = {
  paid: 'ok', 'partially-paid': 'warn', outstanding: 'warn',
  rejected: 'danger', submitted: 'info', adjudicating: 'info', draft: 'neutral',
}

/** One vital sign. Label above value, never beside it: at the largest text
 *  size a side-by-side pair is the first thing that collides. */
function Vital({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="border border-line rounded p-3">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1 tabular-nums">
        <span className="font-serif text-2xl font-bold block leading-tight">{value}</span>
        <span className="text-sm text-ink-soft">{unit}</span>
      </dd>
    </div>
  )
}

export default function PatientDetail() {
  const { id = '' } = useParams()
  const { t, tri, lang, locale, session } = useApp()
  const assistant = useAssistant()
  const [tab, setTab] = useState('summary')

  const role = session?.role ?? 'admin'
  if (!canOpenPatientRecord(role)) {
    return (
      <>
        <PageHeading title={t('patients.title')} />
        <Banner tone="warn" title={t('patients.restricted')}>{t('patients.restrictedHint')}</Banner>
      </>
    )
  }

  const p = getPatient(id)
  if (!p) {
    return (
      <>
        <Link to="/patients" className="jm-link">{t('common.backToRegistry')}</Link>
        <div className="jm-card mt-4"><EmptyState title={t('patient.notFound')} /></div>
      </>
    )
  }

  const doc = staffById.get(p.primaryPhysicianId)
  const dep = departmentsById.get(p.departmentId)
  const payer = payersById.get(p.payerId)
  const encs = encountersFor(p.id).slice().sort((a, b) => b.date.localeCompare(a.date))
  const last = latestEncounter(p.id)
  const panel = latestLabPanel(p.id)
  const meds = medsFor(p.id).slice().sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'))
  const activeMedCount = meds.filter((m) => m.status === 'active').length
  const imgs = imagingFor(p.id)
  const bills = invoicesFor(p.id)

  const TABS = [
    { id: 'summary', label: t('patient.summary') },
    { id: 'encounters', label: t('patient.encounters'), badge: encs.length },
    { id: 'labs', label: t('patient.labs'), badge: panel.length },
    { id: 'meds', label: t('patient.medications'), badge: activeMedCount },
    { id: 'imaging', label: t('patient.imaging'), badge: imgs.length },
    { id: 'billing', label: t('patient.billing'), badge: bills.length },
  ]

  return (
    <>
      <Link to="/patients" className="jm-link inline-block mb-4 jm-noprint">← {t('common.backToRegistry')}</Link>

      {/* Identity banner — always visible, never behind a tab. Allergies and the
          active problem list are the two things a clinician must not have to
          click for. */}
      <div className="jm-card p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="jm-h1">{tri(p.name)}</h1>
            <p className="text-ink-soft mt-2 text-lg tabular-nums">
              {p.mrn} · {p.age} {t('patient.years')} · {t(`patient.sex.${p.sex}` as MsgKey)} · {p.bloodType}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Chip tone={p.status === 'inpatient' ? 'info' : p.status === 'inactive' ? 'neutral' : 'ok'}>
                {t(`patients.status.${p.status}` as MsgKey)}
              </Chip>
              {dep && <Chip tone="neutral">{tri(dep.name)}</Chip>}
              {payer && <Chip tone="neutral">{tri(payer.name)}</Chip>}
            </div>
          </div>
          {canUseAssistant(role) && (
            <button type="button" className="jm-btn-primary jm-noprint" onClick={() => assistant.openWith(p.id)}>
              {t('patient.askAssistant')}
            </button>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2 mt-6 pt-6 border-t border-line">
          <div>
            <h2 className="jm-eyebrow mb-3">{t('patient.allergies')}</h2>
            {p.allergies.length === 0 ? (
              <Chip tone="ok">{t('patient.noAllergies')}</Chip>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {p.allergies.map((a) => <li key={a.en}><Chip tone="danger">⚠ {tri(a)}</Chip></li>)}
              </ul>
            )}
          </div>
          <div>
            <h2 className="jm-eyebrow mb-3">{t('patient.problems')}</h2>
            <ul className="space-y-1.5">
              {p.conditions.map((c) => (
                <li key={c.icd} className="flex gap-3">
                  <span className="font-mono text-sm text-ink-faint shrink-0 w-16">{c.icd}</span>
                  <span>{tri(c.label)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} label={t('patient.summary')} />

      <TabPanel id="summary" active={tab}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('patient.demographics')} />
            <dl>
              <DefRow label={t('patient.fileNo')}><span className="tabular-nums">{p.mrn}</span></DefRow>
              <DefRow label={t('patient.identity')}><span className="font-mono">{p.idMasked}</span></DefRow>
              <DefRow label={t('patient.dob')}>{longDate(p.dob, locale)}</DefRow>
              <DefRow label={t('patient.phone')}><span className="tabular-nums">{p.phone}</span></DefRow>
              <DefRow label={t('patient.district')}>{tri(p.district)}</DefRow>
              <DefRow label={t('patient.physician')}>{doc ? `${tri(doc.name)} · ${doc.credential}` : '—'}</DefRow>
              <DefRow label={t('patient.preferredLanguage')}>
                {p.preferredLanguage === 'en' ? 'English' : p.preferredLanguage === 'zh-Hant' ? '繁體中文' : '简体中文'}
              </DefRow>
              <DefRow label={t('patient.lastVisit')}>{longDate(p.lastVisit, locale)}</DefRow>
              <DefRow label={t('patient.consent')}>
                <Chip tone={p.consentResearch ? 'ok' : 'neutral'}>
                  {p.consentResearch ? t('patient.consent.given') : t('patient.consent.withheld')}
                </Chip>
              </DefRow>
            </dl>
          </Card>

          <div className="space-y-6">
            {last && (
              <Card>
                <CardHeader title={t('patient.vitals')} note={longDate(last.date, locale)} />
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Vital label={t('patient.vitals.bp')} value={`${last.vitals.bpSystolic}/${last.vitals.bpDiastolic}`} unit="mmHg" />
                  <Vital label={t('patient.vitals.hr')} value={String(last.vitals.heartRate)} unit="/min" />
                  <Vital label={t('patient.vitals.temp')} value={String(last.vitals.tempC)} unit="°C" />
                  <Vital label={t('patient.vitals.spo2')} value={String(last.vitals.spo2)} unit="%" />
                  <Vital label={t('patient.vitals.weight')} value={String(last.vitals.weightKg)} unit="kg" />
                  <Vital label={t('patient.vitals.bmi')} value={String(bmi(last.vitals.weightKg, last.vitals.heightCm))} unit="kg/m²" />
                </dl>
              </Card>
            )}
            {activeMedCount >= 5 && (
              <Banner tone="warn">{t('med.polypharmacyWarn', { n: activeMedCount })}</Banner>
            )}
          </div>
        </div>
      </TabPanel>

      <TabPanel id="encounters" active={tab}>
        <TableFrame caption={t('patient.encounters')}>
          <thead>
            <tr>
              <th scope="col">{t('enc.col.date')}</th>
              <th scope="col">{t('enc.col.type')}</th>
              <th scope="col">{t('enc.col.complaint')}</th>
              <th scope="col">{t('enc.col.diagnosis')}</th>
              <th scope="col">{t('enc.col.physician')}</th>
            </tr>
          </thead>
          <tbody>
            {encs.map((e) => {
              const seenBy = staffById.get(e.physicianId)
              return (
                <tr key={e.id}>
                  <td className="tabular-nums whitespace-nowrap">{shortDate(e.date, locale)}</td>
                  <td><Chip tone={e.type === 'emergency' ? 'danger' : e.type === 'inpatient' ? 'info' : 'neutral'}>
                    {t(`enc.type.${e.type}` as MsgKey)}</Chip></td>
                  <td>
                    {tri(e.chiefComplaint)}
                    <p className="text-sm text-ink-soft mt-2"><span className="font-semibold">{t('enc.plan')}: </span>{tri(e.plan)}</p>
                  </td>
                  <td><span className="font-mono text-sm text-ink-faint mr-2">{e.diagnosis.icd}</span>{tri(e.diagnosis.label)}</td>
                  <td className="whitespace-nowrap">{seenBy ? tri(seenBy.name) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      </TabPanel>

      <TabPanel id="labs" active={tab}>
        <div className="mb-5"><Banner tone="info">{t('lab.provenanceNote')}</Banner></div>
        {panel.length === 0 ? (
          <div className="jm-card"><EmptyState title={t('common.noResults')} /></div>
        ) : (
          <TableFrame caption={t('patient.labs')}>
            <thead>
              <tr>
                <th scope="col">{t('lab.col.analyte')}</th>
                <th scope="col">{t('lab.col.value')}</th>
                <th scope="col">{t('lab.col.ref')}</th>
                <th scope="col">{t('lab.col.flag')}</th>
                <th scope="col">{t('lab.trend')}</th>
                <th scope="col">{t('lab.col.date')}</th>
                <th scope="col">{t('lab.col.method')}</th>
              </tr>
            </thead>
            <tbody>
              {panel.map((l) => {
                const series = labSeries(p.id, l.code).map((x) => x.value)
                return (
                  <tr key={l.id}>
                    <td>
                      <div>{tri(l.analyte)}</div>
                      <div className="text-sm text-ink-faint">{tri(l.panelName)}</div>
                    </td>
                    <td className="tabular-nums font-semibold whitespace-nowrap text-lg">
                      {num(l.value, locale, Number.isInteger(l.value) ? 0 : 1)} <span className="text-sm font-normal text-ink-soft">{l.unit}</span>
                    </td>
                    <td className="tabular-nums whitespace-nowrap text-ink-soft">{refRange(l.refLow, l.refHigh, locale, lang)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <StatusDot tone={FLAG_TONE[l.flag] as Tone} />
                        <Chip tone={FLAG_TONE[l.flag]}>{t(`lab.flag.${l.flag}` as MsgKey)}</Chip>
                      </span>
                    </td>
                    <td><Sparkline values={series} /></td>
                    <td className="tabular-nums whitespace-nowrap">{shortDate(l.date, locale)}</td>
                    <td className="text-sm text-ink-soft">{l.method}<div className="text-ink-faint">{tri(l.performingLab)}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </TableFrame>
        )}
      </TabPanel>

      <TabPanel id="meds" active={tab}>
        {activeMedCount >= 5 && (
          <div className="mb-5"><Banner tone="warn">{t('med.polypharmacyWarn', { n: activeMedCount })}</Banner></div>
        )}
        <TableFrame caption={t('patient.medications')}>
          <thead>
            <tr>
              <th scope="col">{t('med.col.drug')}</th>
              <th scope="col">{t('med.col.dose')}</th>
              <th scope="col">{t('med.col.freq')}</th>
              <th scope="col">{t('med.col.route')}</th>
              <th scope="col">{t('med.col.started')}</th>
              <th scope="col">{t('med.col.prescriber')}</th>
              <th scope="col">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const pres = staffById.get(m.prescriberId)
              return (
                <tr key={m.id} className={m.status === 'discontinued' ? 'text-ink-faint' : ''}>
                  <td>
                    <div className="font-semibold">{tri(m.drug)}</div>
                    <div className="text-sm text-ink-faint">{m.drugClass}</div>
                  </td>
                  <td className="tabular-nums whitespace-nowrap">{m.dose}</td>
                  <td className="whitespace-nowrap">{m.frequency}</td>
                  <td>{m.route}</td>
                  <td className="tabular-nums whitespace-nowrap">{shortDate(m.startDate, locale)}</td>
                  <td className="whitespace-nowrap">{pres ? tri(pres.name) : '—'}</td>
                  <td><Chip tone={m.status === 'active' ? 'ok' : 'neutral'}>{t(`med.status.${m.status}` as MsgKey)}</Chip></td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      </TabPanel>

      <TabPanel id="imaging" active={tab}>
        {imgs.length === 0 ? (
          <div className="jm-card"><EmptyState title={t('common.none')} /></div>
        ) : (
          <TableFrame caption={t('patient.imaging')}>
            <thead>
              <tr>
                <th scope="col">{t('img.col.date')}</th>
                <th scope="col">{t('img.col.study')}</th>
                <th scope="col">{t('img.col.modality')}</th>
                <th scope="col">{t('img.col.findings')}</th>
                <th scope="col">{t('img.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {imgs.map((i) => (
                <tr key={i.id}>
                  <td className="tabular-nums whitespace-nowrap">{shortDate(i.date, locale)}</td>
                  <td>{tri(i.study)}<div className="text-sm text-ink-faint font-mono">{i.accession}</div></td>
                  <td>{i.modality}</td>
                  <td>{tri(i.findings)}</td>
                  <td><Chip tone={i.status === 'finalised' ? 'ok' : 'warn'}>{t(`img.status.${i.status}` as MsgKey)}</Chip></td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </TabPanel>

      <TabPanel id="billing" active={tab}>
        {bills.length === 0 ? (
          <div className="jm-card"><EmptyState title={t('common.none')} /></div>
        ) : (
          <TableFrame caption={t('patient.billing')}>
            <thead>
              <tr>
                <th scope="col">{t('bill.col.invoice')}</th>
                <th scope="col">{t('bill.col.date')}</th>
                <th scope="col">{t('bill.col.gross')}</th>
                <th scope="col">{t('bill.col.covered')}</th>
                <th scope="col">{t('bill.col.patientPays')}</th>
                <th scope="col">{t('bill.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono whitespace-nowrap">{b.id}</td>
                  <td className="tabular-nums whitespace-nowrap">{shortDate(b.date, locale)}</td>
                  <td className="tabular-nums whitespace-nowrap">{money(b.grossAmount, locale)}</td>
                  <td className="tabular-nums whitespace-nowrap">{money(b.coveredAmount, locale)}</td>
                  <td className="tabular-nums whitespace-nowrap font-semibold">{money(b.patientResponsibility, locale)}</td>
                  <td>
                    <Chip tone={CLAIM_TONE[b.claimStatus]}>{t(`bill.status.${b.claimStatus}` as MsgKey)}</Chip>
                    {b.rejectionReason && <div className="text-sm text-danger mt-1.5">{tri(b.rejectionReason)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </TabPanel>
    </>
  )
}
