import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { PageHeading, TableFrame, Chip, Tabs, TabPanel, EmptyState, Select } from '@/components/ui'
import { db, TODAY, patientsById, departmentsById, staffById } from '@/lib/data'
import { canOpenPatientRecord } from '@/lib/roles'
import { longDate, timeOnly, weekday } from '@/lib/format'
import type { MsgKey } from '@/i18n'
import type { Appointment } from '@/lib/types'

const STATUS_TONE: Record<Appointment['status'], 'ok' | 'warn' | 'danger' | 'neutral' | 'info'> = {
  scheduled: 'neutral', 'checked-in': 'info', completed: 'ok', 'no-show': 'danger',
}

export default function Appointments() {
  const { t, tri, locale, session } = useApp()
  const canOpen = canOpenPatientRecord(session?.role ?? 'admin')
  const [tab, setTab] = useState('today')
  const [dept, setDept] = useState('all')

  const buckets = useMemo(() => {
    const filtered = db.appointments.filter((a) => dept === 'all' || a.departmentId === dept)
    return {
      today: filtered.filter((a) => a.datetime.startsWith(TODAY)),
      upcoming: filtered.filter((a) => a.datetime.slice(0, 10) > TODAY),
      past: filtered.filter((a) => a.datetime.slice(0, 10) < TODAY).reverse(),
    }
  }, [dept])

  const TABS = [
    { id: 'today', label: t('appt.tab.today'), badge: buckets.today.length },
    { id: 'upcoming', label: t('appt.tab.upcoming'), badge: buckets.upcoming.length },
    { id: 'past', label: t('appt.tab.past'), badge: buckets.past.length },
  ]

  const Table = ({ rows, withDate }: { rows: Appointment[]; withDate: boolean }) => {
    if (rows.length === 0) return <div className="jm-card"><EmptyState title={t('appt.none')} /></div>
    // Group by day so a long list stays navigable rather than becoming a wall.
    const days = [...new Set(rows.map((r) => r.datetime.slice(0, 10)))]
    return (
      <div className="space-y-7">
        {days.map((day) => (
          <section key={day}>
            {withDate && (
              <h3 className="jm-h3 mb-3">
                {longDate(day, locale)}
                <span className="text-ink-soft font-normal ml-3 text-base">{weekday(day, locale)}</span>
              </h3>
            )}
            <TableFrame caption={`${t('appt.title')} — ${day}`}>
              <thead>
                <tr>
                  <th scope="col">{t('appt.col.time')}</th>
                  <th scope="col">{t('appt.col.patient')}</th>
                  <th scope="col">{t('appt.col.department')}</th>
                  <th scope="col">{t('appt.col.physician')}</th>
                  <th scope="col">{t('appt.col.room')}</th>
                  <th scope="col">{t('appt.col.type')}</th>
                  <th scope="col">{t('appt.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.datetime.startsWith(day)).map((a) => {
                  const p = patientsById.get(a.patientId)
                  const dep = departmentsById.get(a.departmentId)
                  const doc = staffById.get(a.physicianId)
                  return (
                    <tr key={a.id}>
                      <td className="tabular-nums font-semibold text-lg whitespace-nowrap">{timeOnly(a.datetime)}</td>
                      <td>
                        {canOpen && p
                          ? <Link className="jm-link" to={`/patients/${p.id}`}>{tri(p.name)}</Link>
                          : <span className="tabular-nums text-ink-faint">{p?.mrn ?? '—'}</span>}
                        {a.interpreterNeeded && <div className="mt-1.5"><Chip tone="info">{t('appt.interpreter')}</Chip></div>}
                      </td>
                      <td className="whitespace-nowrap">{dep ? tri(dep.name) : '—'}</td>
                      <td className="whitespace-nowrap">{doc ? tri(doc.name) : '—'}</td>
                      <td className="whitespace-nowrap">{a.room}</td>
                      <td className="whitespace-nowrap">{t(`appt.type.${a.type}` as MsgKey)}</td>
                      <td><Chip tone={STATUS_TONE[a.status]}>{t(`appt.status.${a.status}` as MsgKey)}</Chip></td>
                    </tr>
                  )
                })}
              </tbody>
            </TableFrame>
          </section>
        ))}
      </div>
    )
  }

  return (
    <>
      <PageHeading title={t('appt.title')} note={longDate(TODAY, locale)} />

      <div className="jm-card p-5 mb-6 max-w-md">
        <Select
          id="ap-dept" label={t('appt.col.department')} value={dept} onChange={setDept}
          options={[{ value: 'all', label: t('common.all') },
            ...db.departments.map((d) => ({ value: d.id, label: tri(d.name) }))]}
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} label={t('appt.title')} />
      <TabPanel id="today" active={tab}><Table rows={buckets.today} withDate={false} /></TabPanel>
      <TabPanel id="upcoming" active={tab}><Table rows={buckets.upcoming} withDate /></TabPanel>
      <TabPanel id="past" active={tab}><Table rows={buckets.past} withDate /></TabPanel>
    </>
  )
}
