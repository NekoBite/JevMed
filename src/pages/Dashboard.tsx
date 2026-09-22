import { Link } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { Card, CardHeader, StatTile, PageHeading, Banner, TableFrame, Chip } from '@/components/ui'
import { HorizontalBars, VerticalBars } from '@/components/Charts'
import { money, num, greetingKey, longDate, timeOnly } from '@/lib/format'
import { canOpenPatientRecord } from '@/lib/roles'
import {
  db, TODAY, departmentsById, patientsById,
  encountersByDepartment, claimStatusBreakdown, ageBands, receivablesAgeing,
  criticalLabs, todaysAppointments, openClaims, rejectedClaims,
  inventoryTotals, staffOnDutyToday,
} from '@/lib/data'
import type { MsgKey } from '@/i18n'

export default function Dashboard() {
  const { t, tri, locale, session } = useApp()
  const role = session?.role ?? 'admin'
  const showsRecords = canOpenPatientRecord(role)

  const inv = inventoryTotals()
  const crit = criticalLabs()
  const today = todaysAppointments()
  const noShows = db.appointments.filter((a) => a.status === 'no-show').length
  const rejected = rejectedClaims().length

  const attention = [
    inv.expiring > 0 && { n: inv.expiring, key: 'dash.attention.expiring' as MsgKey, to: '/inventory' },
    inv.belowReorder > 0 && { n: inv.belowReorder, key: 'dash.attention.belowReorder' as MsgKey, to: '/inventory' },
    rejected > 0 && { n: rejected, key: 'dash.attention.rejected' as MsgKey, to: '/billing' },
    showsRecords && crit.length > 0 && { n: crit.length, key: 'dash.attention.critical' as MsgKey, to: '/patients' },
    noShows > 0 && { n: noShows, key: 'dash.attention.noShow' as MsgKey, to: '/appointments' },
  ].filter(Boolean) as { n: number; key: MsgKey; to: string }[]

  const fmtMoney = (v: number) => money(v, locale)
  const fmtNum = (v: number) => num(v, locale)

  return (
    <>
      <PageHeading title={t('dash.title')} note={`${t(greetingKey())} · ${t('dash.asOf')} ${longDate(TODAY, locale)}`} />

      {role === 'chairman' && (
        <div className="mb-7"><Banner tone="info">{t('dash.chairmanNote')}</Banner></div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 mb-8">
        <StatTile label={t('dash.kpi.activePatients')} value={fmtNum(db.patients.filter((p) => p.status !== 'inactive').length)}
          sub={`${fmtNum(db.patients.length)} ${t('patients.count')}`} tone="info" />
        <StatTile label={t('dash.kpi.todayAppointments')} value={fmtNum(today.length)}
          sub={longDate(TODAY, locale)} />
        <StatTile label={t('dash.kpi.openClaims')} value={fmtNum(openClaims().length)}
          sub={fmtMoney(openClaims().reduce((s, i) => s + (i.grossAmount - i.coveredAmount), 0))}
          tone={rejected > 0 ? 'warn' : 'neutral'} />
        <StatTile label={t('dash.kpi.stockAlerts')} value={fmtNum(inv.belowReorder + inv.expiring + inv.expired)}
          sub={`${t('inv.kpi.value')} ${fmtMoney(inv.value)}`}
          tone={inv.expired > 0 ? 'danger' : inv.belowReorder > 0 ? 'warn' : 'ok'} />
        {showsRecords && (
          <StatTile label={t('dash.kpi.criticalResults')} value={fmtNum(crit.length)}
            tone={crit.length > 0 ? 'danger' : 'ok'} />
        )}
        <StatTile label={t('dash.kpi.staffOnDuty')} value={fmtNum(staffOnDutyToday().length)}
          sub={t('dash.kpi.staffOnDuty.sub', { total: fmtNum(db.staff.length) })} />
      </div>

      <Card className="mb-8">
        <CardHeader title={t('dash.attention')} />
        {attention.length === 0 ? (
          <Banner tone="ok">{t('dash.attention.none')}</Banner>
        ) : (
          <ul className="space-y-3">
            {attention.map((a) => (
              <li key={a.key}>
                <Link to={a.to} className="flex items-center gap-4 min-h-[3rem] px-4 py-2 rounded border border-line hover:bg-primary-light">
                  <span className="font-serif text-2xl font-bold tabular-nums text-primary w-14 shrink-0">{fmtNum(a.n)}</span>
                  <span className="text-ink">{t(a.key)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2 mb-8">
        <Card>
          <CardHeader title={t('dash.chart.encounters')} />
          <HorizontalBars
            title={t('dash.chart.encounters')}
            format={fmtNum}
            data={encountersByDepartment().map((d) => ({ label: tri(d.dept.name), value: d.count }))}
          />
        </Card>

        <Card>
          <CardHeader title={t('dash.chart.claims')} />
          <HorizontalBars
            title={t('dash.chart.claims')}
            format={fmtMoney}
            data={claimStatusBreakdown().map((c) => ({
              label: t(`bill.status.${c.status}` as MsgKey),
              value: c.amount,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title={t('dash.chart.ageBands')} />
          <VerticalBars title={t('dash.chart.ageBands')} format={fmtNum} data={ageBands().map((b) => ({ label: b.band, value: b.count }))} />
        </Card>

        <Card>
          <CardHeader title={t('dash.chart.receivables')} />
          <VerticalBars
            title={t('dash.chart.receivables')} ordinal format={fmtMoney}
            data={receivablesAgeing().map((b) => ({ label: b.bucket, value: Math.round(b.amount) }))}
          />
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader title={t('dash.upcoming')} note={longDate(TODAY, locale)} />
        {today.length === 0 ? (
          <p className="text-ink-soft">{t('appt.none')}</p>
        ) : (
          <TableFrame caption={t('dash.upcoming')}>
            <thead>
              <tr>
                <th scope="col">{t('appt.col.time')}</th>
                <th scope="col">{t('appt.col.patient')}</th>
                <th scope="col">{t('appt.col.department')}</th>
                <th scope="col">{t('appt.col.room')}</th>
                <th scope="col">{t('appt.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {today.slice(0, 10).map((a) => {
                const p = patientsById.get(a.patientId)
                const dept = departmentsById.get(a.departmentId)
                return (
                  <tr key={a.id}>
                    <td className="tabular-nums font-semibold">{timeOnly(a.datetime)}</td>
                    <td>{showsRecords && p ? <Link className="jm-link" to={`/patients/${p.id}`}>{tri(p.name)}</Link> : <span className="text-ink-faint">{p?.mrn ?? '—'}</span>}</td>
                    <td>{dept ? tri(dept.name) : '—'}</td>
                    <td>{a.room}</td>
                    <td><Chip tone={a.status === 'no-show' ? 'danger' : a.status === 'checked-in' ? 'ok' : 'neutral'}>{t(`appt.status.${a.status}` as MsgKey)}</Chip></td>
                  </tr>
                )
              })}
            </tbody>
          </TableFrame>
        )}
      </Card>

      {showsRecords && crit.length > 0 && (
        <Card>
          <CardHeader title={t('dash.recentCritical')} />
          <TableFrame caption={t('dash.recentCritical')}>
            <thead>
              <tr>
                <th scope="col">{t('lab.col.date')}</th>
                <th scope="col">{t('appt.col.patient')}</th>
                <th scope="col">{t('lab.col.analyte')}</th>
                <th scope="col">{t('lab.col.value')}</th>
                <th scope="col">{t('lab.col.flag')}</th>
              </tr>
            </thead>
            <tbody>
              {crit.slice(0, 8).map((l) => {
                const p = patientsById.get(l.patientId)
                return (
                  <tr key={l.id}>
                    <td className="tabular-nums whitespace-nowrap">{l.date}</td>
                    <td>{p ? <Link className="jm-link" to={`/patients/${p.id}`}>{tri(p.name)}</Link> : '—'}</td>
                    <td>{tri(l.analyte)}</td>
                    <td className="tabular-nums font-semibold whitespace-nowrap">{l.value} {l.unit}</td>
                    <td><Chip tone="danger">{t(`lab.flag.${l.flag}` as MsgKey)}</Chip></td>
                  </tr>
                )
              })}
            </tbody>
          </TableFrame>
        </Card>
      )}
    </>
  )
}
