import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { PageHeading, TableFrame, Chip, StatTile, Select, EmptyState, Card, CardHeader } from '@/components/ui'
import { db, patientsById, payersById, billingTotals } from '@/lib/data'
import { canOpenPatientRecord } from '@/lib/roles'
import { money, pct, shortDate, num } from '@/lib/format'
import { CLAIM_TONE } from './PatientDetail'
import type { MsgKey } from '@/i18n'

const STATUSES = ['draft', 'submitted', 'adjudicating', 'partially-paid', 'paid', 'rejected', 'outstanding'] as const

export default function Billing() {
  const { t, tri, locale, session } = useApp()
  const canOpen = canOpenPatientRecord(session?.role ?? 'admin')
  const [payer, setPayer] = useState('all')
  const [status, setStatus] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const totals = billingTotals()
  const rows = useMemo(() => db.invoices.filter((i) =>
    (payer === 'all' || i.payerId === payer) && (status === 'all' || i.claimStatus === status)
  ), [payer, status])

  return (
    <>
      <PageHeading title={t('bill.title')} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatTile label={t('bill.kpi.billed')} value={money(totals.billed, locale)} tone="info" />
        <StatTile label={t('bill.kpi.settled')} value={money(totals.settled, locale)} tone="ok" />
        <StatTile label={t('bill.kpi.outstanding')} value={money(totals.outstanding, locale)} tone="warn" />
        <StatTile label={t('bill.kpi.rejectRate')} value={pct(totals.rejectRate, locale)}
          tone={totals.rejectRate > 0.1 ? 'danger' : 'neutral'} />
      </div>

      <Card className="mb-6">
        <CardHeader title={t('common.search')} />
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          <Select id="bl-payer" label={t('bill.filter.payer')} value={payer} onChange={setPayer}
            options={[{ value: 'all', label: t('common.all') }, ...db.payers.map((p) => ({ value: p.id, label: tri(p.name) }))]} />
          <Select id="bl-status" label={t('bill.filter.status')} value={status} onChange={setStatus}
            options={[{ value: 'all', label: t('common.all') },
              ...STATUSES.map((s) => ({ value: s, label: t(`bill.status.${s}` as MsgKey) }))]} />
        </div>
        <p className="text-sm text-ink-soft mt-4" role="status">
          {t('common.showing')} {rows.length} {t('common.of')} {db.invoices.length} {t('common.records')}
        </p>
      </Card>

      {rows.length === 0 ? (
        <div className="jm-card"><EmptyState title={t('common.noResults')} hint={t('common.noResultsHint')} /></div>
      ) : (
        <TableFrame caption={t('bill.title')} minWidth="min-w-[86rem]">
          <thead>
            <tr>
              <th scope="col">{t('bill.col.invoice')}</th>
              <th scope="col">{t('bill.col.patient')}</th>
              <th scope="col">{t('bill.col.date')}</th>
              <th scope="col">{t('bill.col.payer')}</th>
              <th scope="col">{t('bill.col.gross')}</th>
              <th scope="col">{t('bill.col.covered')}</th>
              <th scope="col">{t('bill.col.patientPays')}</th>
              <th scope="col">{t('bill.col.ageing')}</th>
              <th scope="col">{t('bill.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const p = patientsById.get(b.patientId)
              const pay = payersById.get(b.payerId)
              const open = expanded === b.id
              return (
                <tr key={b.id}>
                  <td className="align-top">
                    <button type="button" className="jm-link font-mono" aria-expanded={open}
                      onClick={() => setExpanded(open ? null : b.id)}>
                      {b.id}
                    </button>
                    {open && (
                      <div className="mt-3 p-4 bg-canvas rounded border border-line min-w-[20rem]">
                        <p className="jm-eyebrow mb-2">{t('bill.lines')}</p>
                        <ul className="space-y-1.5">
                          {b.lines.map((l) => (
                            <li key={l.code} className="flex justify-between gap-6 text-sm">
                              <span>{tri(l.label)} <span className="text-ink-faint">× {l.qty}</span></span>
                              <span className="tabular-nums font-semibold">{money(l.amount, locale)}</span>
                            </li>
                          ))}
                        </ul>
                        {b.claimRef && <p className="text-sm text-ink-faint mt-3 font-mono">{b.claimRef}</p>}
                      </div>
                    )}
                  </td>
                  <td className="align-top">
                    {canOpen && p ? <Link className="jm-link" to={`/patients/${p.id}`}>{tri(p.name)}</Link>
                      : <span className="tabular-nums text-ink-faint">{p?.mrn ?? '—'}</span>}
                  </td>
                  <td className="align-top tabular-nums whitespace-nowrap">{shortDate(b.date, locale)}</td>
                  <td className="align-top">{pay ? tri(pay.name) : '—'}</td>
                  <td className="align-top tabular-nums whitespace-nowrap">{money(b.grossAmount, locale)}</td>
                  <td className="align-top tabular-nums whitespace-nowrap">{money(b.coveredAmount, locale)}</td>
                  <td className="align-top tabular-nums whitespace-nowrap font-semibold">{money(b.patientResponsibility, locale)}</td>
                  <td className="align-top tabular-nums">{b.daysOutstanding > 0 ? num(b.daysOutstanding, locale) : '—'}</td>
                  <td className="align-top">
                    <Chip tone={CLAIM_TONE[b.claimStatus]}>{t(`bill.status.${b.claimStatus}` as MsgKey)}</Chip>
                    {b.rejectionReason && (
                      <div className="text-sm text-danger mt-2 max-w-[16rem]">
                        <span className="font-semibold">{t('bill.rejectionReason')}: </span>{tri(b.rejectionReason)}
                      </div>
                    )}
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
