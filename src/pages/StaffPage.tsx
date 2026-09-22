import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { PageHeading, TableFrame, Chip, Tabs, TabPanel, Card, CardHeader } from '@/components/ui'
import { db, departmentsById, staffById, TODAY } from '@/lib/data'
import { longDate, weekday, num } from '@/lib/format'
import type { MsgKey } from '@/i18n'

export default function StaffPage() {
  const { t, tri, locale } = useApp()
  const [tab, setTab] = useState('directory')

  const days = [...new Set(db.roster.map((r) => r.date))].sort()

  return (
    <>
      <PageHeading title={t('staff.title')} />

      <Tabs
        tabs={[
          { id: 'directory', label: t('staff.tab.directory'), badge: db.staff.length },
          { id: 'roster', label: t('staff.tab.roster') },
        ]}
        active={tab} onChange={setTab} label={t('staff.title')}
      />

      <TabPanel id="directory" active={tab}>
        <TableFrame caption={t('staff.tab.directory')}>
          <thead>
            <tr>
              <th scope="col">{t('staff.col.name')}</th>
              <th scope="col">{t('staff.col.role')}</th>
              <th scope="col">{t('staff.col.department')}</th>
              <th scope="col">{t('staff.col.credential')}</th>
              <th scope="col">{t('staff.col.contact')}</th>
              <th scope="col">{t('staff.col.service')}</th>
              <th scope="col">{t('staff.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {db.staff.map((s) => {
              const dep = departmentsById.get(s.departmentId)
              return (
                <tr key={s.id}>
                  <td className="font-semibold">{tri(s.name)}</td>
                  <td className="whitespace-nowrap">{t(`staff.role.${s.role}` as MsgKey)}</td>
                  <td className="whitespace-nowrap">{dep ? tri(dep.name) : '—'}</td>
                  <td className="text-sm">{s.credential}</td>
                  <td className="text-sm">
                    <div className="tabular-nums">ext. {s.extension}</div>
                    <div className="text-ink-faint break-all">{s.email}</div>
                  </td>
                  <td className="tabular-nums">{num(s.yearsOfService, locale)}</td>
                  <td><Chip tone={s.status === 'active' ? 'ok' : 'warn'}>{t(`staff.status.${s.status}` as MsgKey)}</Chip></td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      </TabPanel>

      <TabPanel id="roster" active={tab}>
        <p className="text-ink-soft mb-6 max-w-prose">{t('staff.rosterNote')}</p>
        <div className="grid gap-5 lg:grid-cols-2">
          {days.map((day) => {
            const shifts = db.roster.filter((r) => r.date === day)
            return (
              <Card key={day} className={day === TODAY ? 'border-primary border-2' : ''}>
                <CardHeader
                  title={longDate(day, locale)}
                  note={`${weekday(day, locale)}${day === TODAY ? ` · ${t('common.today')}` : ''}`}
                />
                <div className="space-y-4">
                  {shifts.map((r) => {
                    const onCall = staffById.get(r.onCallId)
                    return (
                      <div key={r.shift} className="border-t border-line pt-3 first:border-0 first:pt-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="font-bold">{t(`staff.shift.${r.shift}` as MsgKey)}</h4>
                          {onCall && <span className="text-sm"><span className="text-ink-faint">{t('staff.onCall')}: </span>{tri(onCall.name)}</span>}
                        </div>
                        <ul className="flex flex-wrap gap-2 mt-2">
                          {r.staffIds.map((sid) => {
                            const p = staffById.get(sid)
                            return p ? <li key={sid}><Chip tone="neutral">{tri(p.name)}</Chip></li> : null
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </TabPanel>
    </>
  )
}
