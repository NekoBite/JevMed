import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { PageHeading, TableFrame, Chip, SearchInput, Select, EmptyState, Banner, StatusDot } from '@/components/ui'
import { db, departmentsById, payersById, staffById } from '@/lib/data'
import { canOpenPatientRecord } from '@/lib/roles'
import { shortDate } from '@/lib/format'
import type { MsgKey } from '@/i18n'
import type { Patient } from '@/lib/types'
import type { Tone } from '@/components/ui'

type SortKey = 'acuity' | 'name' | 'lastVisit'

export default function Patients() {
  const { t, tri, locale, session } = useApp()
  const role = session?.role ?? 'admin'
  const canOpen = canOpenPatientRecord(role)

  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [status, setStatus] = useState('all')
  const [payer, setPayer] = useState('all')
  const [sort, setSort] = useState<SortKey>('acuity')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = db.patients.filter((p) => {
      if (dept !== 'all' && p.departmentId !== dept) return false
      if (status !== 'all' && p.status !== status) return false
      if (payer !== 'all' && p.payerId !== payer) return false
      if (!needle) return true
      // Search across all three name scripts so a colleague typing 陳 finds the
      // same record as a colleague typing "Chan".
      const hay = [
        p.name.en, p.name['zh-Hant'], p.name['zh-Hans'], p.mrn,
        ...p.conditions.flatMap((c) => [c.icd, c.label.en, c.label['zh-Hant'], c.label['zh-Hans']]),
      ].join(' ').toLowerCase()
      return hay.includes(needle)
    })
    out = out.slice().sort((a, b) => {
      if (sort === 'name') return tri(a.name).localeCompare(tri(b.name), locale)
      if (sort === 'lastVisit') return b.lastVisit.localeCompare(a.lastVisit)
      return b.acuity - a.acuity
    })
    return out
  }, [q, dept, status, payer, sort, tri, locale])

  const acuityTone = (n: number): Tone => (n >= 75 ? 'danger' : n >= 55 ? 'warn' : 'ok')
  const statusTone = (s: Patient['status']): Tone => (s === 'inpatient' ? 'info' : s === 'inactive' ? 'neutral' : 'ok')
  const filtersOn = q !== '' || dept !== 'all' || status !== 'all' || payer !== 'all'

  return (
    <>
      <PageHeading
        title={t('patients.title')}
        note={`${db.patients.length} ${t('patients.count')}`}
      />

      {!canOpen && (
        <div className="mb-7">
          <Banner tone="warn" title={t('patients.restricted')}>{t('patients.restrictedHint')}</Banner>
        </div>
      )}

      <div className="jm-card p-5 mb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <SearchInput id="pt-q" label={t('common.search')} value={q} onChange={setQ} placeholder={t('common.searchPatients')} />
          </div>
          <Select
            id="pt-dept" label={t('patients.filter.department')} value={dept} onChange={setDept}
            options={[{ value: 'all', label: t('common.all') },
              ...db.departments.map((d) => ({ value: d.id, label: tri(d.name) }))]}
          />
          <Select
            id="pt-status" label={t('patients.filter.status')} value={status} onChange={setStatus}
            options={[{ value: 'all', label: t('common.all') },
              { value: 'active', label: t('patients.status.active') },
              { value: 'inpatient', label: t('patients.status.inpatient') },
              { value: 'inactive', label: t('patients.status.inactive') }]}
          />
          <Select
            id="pt-payer" label={t('patients.filter.payer')} value={payer} onChange={setPayer}
            options={[{ value: 'all', label: t('common.all') },
              ...db.payers.map((p) => ({ value: p.id, label: tri(p.name) }))]}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-line">
          <div className="min-w-[16rem]">
            <Select
              id="pt-sort" label={t('common.sortBy')} value={sort} onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: 'acuity', label: t('patients.sort.acuity') },
                { value: 'lastVisit', label: t('patients.sort.lastVisit') },
                { value: 'name', label: t('patients.sort.name') },
              ]}
            />
          </div>
          <p className="text-sm text-ink-soft min-h-[3rem] flex items-center" role="status">
            {t('common.showing')} {rows.length} {t('common.of')} {db.patients.length} {t('common.records')}
          </p>
          {filtersOn && (
            <button type="button" className="jm-btn-secondary jm-btn-sm"
              onClick={() => { setQ(''); setDept('all'); setStatus('all'); setPayer('all') }}>
              {t('common.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="jm-card"><EmptyState title={t('common.noResults')} hint={t('common.noResultsHint')} /></div>
      ) : (
        <TableFrame caption={t('patients.title')} minWidth="min-w-[78rem]">
          <thead>
            <tr>
              <th scope="col">{t('patients.col.name')}</th>
              <th scope="col">{t('patients.col.file')}</th>
              <th scope="col">{t('patients.col.age')}</th>
              <th scope="col">{t('patients.col.conditions')}</th>
              <th scope="col">{t('patients.col.physician')}</th>
              <th scope="col">{t('patients.col.lastVisit')}</th>
              <th scope="col">{t('common.status')}</th>
              <th scope="col">{t('patients.col.acuity')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const doc = staffById.get(p.primaryPhysicianId)
              const payerName = payersById.get(p.payerId)
              const dep = departmentsById.get(p.departmentId)
              return (
                <tr key={p.id}>
                  <td>
                    {canOpen
                      ? <Link className="jm-link text-lg" to={`/patients/${p.id}`}>{tri(p.name)}</Link>
                      : <span className="text-ink-faint">{t('patients.restricted')}</span>}
                    <div className="text-sm text-ink-faint mt-1">
                      {dep ? tri(dep.name) : ''} · {payerName ? tri(payerName.name) : ''}
                    </div>
                  </td>
                  <td className="tabular-nums whitespace-nowrap">{p.mrn}</td>
                  <td className="tabular-nums whitespace-nowrap">{p.age} · {t(`patient.sex.${p.sex}` as MsgKey)}</td>
                  <td>
                    <ul className="space-y-1">
                      {p.conditions.slice(0, 3).map((c) => (
                        <li key={c.icd} className="text-sm">
                          <span className="font-mono text-xs text-ink-faint mr-2">{c.icd}</span>{tri(c.label)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="whitespace-nowrap">{doc ? tri(doc.name) : '—'}</td>
                  <td className="tabular-nums whitespace-nowrap">{shortDate(p.lastVisit, locale)}</td>
                  <td><Chip tone={statusTone(p.status)}>{t(`patients.status.${p.status}` as MsgKey)}</Chip></td>
                  <td>
                    <span className="inline-flex items-center gap-2 tabular-nums font-semibold">
                      <StatusDot tone={acuityTone(p.acuity)} />{p.acuity}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      )}
    </>
  )
}
