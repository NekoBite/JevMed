import { useMemo, useState } from 'react'
import { useApp } from '@/lib/app-context'
import { PageHeading, TableFrame, Chip, Select, Banner, Card, CardHeader, EmptyState, StatTile } from '@/components/ui'
import { db, staffById } from '@/lib/data'
import { num } from '@/lib/format'
import type { MsgKey } from '@/i18n'

export default function Audit() {
  const { t, tri, locale } = useApp()
  const [result, setResult] = useState('all')
  const [action, setAction] = useState('all')

  const actions = useMemo(() => [...new Set(db.auditLog.map((a) => a.action))].sort(), [])
  const rows = useMemo(() => db.auditLog.filter((a) =>
    (result === 'all' || a.result === result) && (action === 'all' || a.action === action)
  ), [result, action])

  const denied = db.auditLog.filter((a) => a.result === 'denied').length
  const aiQueries = db.auditLog.filter((a) => a.action === 'ai-query').length

  return (
    <>
      <PageHeading title={t('audit.title')} />

      <div className="mb-7"><Banner tone="info">{t('audit.intro')}</Banner></div>

      <div className="grid gap-5 sm:grid-cols-3 mb-8">
        <StatTile label={t('audit.title')} value={num(db.auditLog.length, locale)} tone="info" />
        <StatTile label={t('audit.result.denied')} value={num(denied, locale)}
          sub={t('audit.deniedCount')} tone={denied > 0 ? 'warn' : 'ok'} />
        <StatTile label={t('audit.action.ai-query')} value={num(aiQueries, locale)} />
      </div>

      <Card className="mb-6">
        <CardHeader title={t('common.search')} />
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          <Select id="au-result" label={t('audit.filter.result')} value={result} onChange={setResult}
            options={[{ value: 'all', label: t('common.all') },
              { value: 'permitted', label: t('audit.result.permitted') },
              { value: 'denied', label: t('audit.result.denied') }]} />
          <Select id="au-action" label={t('audit.filter.action')} value={action} onChange={setAction}
            options={[{ value: 'all', label: t('common.all') },
              ...actions.map((a) => ({ value: a, label: t(`audit.action.${a}` as MsgKey) }))]} />
        </div>
        <p className="text-sm text-ink-soft mt-4" role="status">
          {t('common.showing')} {rows.length} {t('common.of')} {db.auditLog.length} {t('common.records')}
        </p>
      </Card>

      {rows.length === 0 ? (
        <div className="jm-card"><EmptyState title={t('common.noResults')} hint={t('common.noResultsHint')} /></div>
      ) : (
        <TableFrame caption={t('audit.title')} minWidth="min-w-[74rem]">
          <thead>
            <tr>
              <th scope="col">{t('audit.col.time')}</th>
              <th scope="col">{t('audit.col.actor')}</th>
              <th scope="col">{t('audit.col.role')}</th>
              <th scope="col">{t('audit.col.action')}</th>
              <th scope="col">{t('audit.col.entity')}</th>
              <th scope="col">{t('audit.col.purpose')}</th>
              <th scope="col">{t('audit.col.ip')}</th>
              <th scope="col">{t('audit.col.result')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((a) => {
              const who = staffById.get(a.actorId)
              return (
                <tr key={a.id}>
                  <td className="tabular-nums whitespace-nowrap">{a.timestamp}</td>
                  <td className="whitespace-nowrap">{who ? tri(who.name) : a.actorId}</td>
                  <td className="whitespace-nowrap">{t(`staff.role.${a.actorRole}` as MsgKey)}</td>
                  <td className="whitespace-nowrap">{t(`audit.action.${a.action}` as MsgKey)}</td>
                  <td className="font-mono text-sm whitespace-nowrap">{a.entity} · {a.entityId}</td>
                  <td className="whitespace-nowrap">{t(`audit.purpose.${a.purpose}` as MsgKey)}</td>
                  <td className="font-mono text-sm tabular-nums">{a.ip}</td>
                  <td><Chip tone={a.result === 'denied' ? 'danger' : 'ok'}>{t(`audit.result.${a.result}` as MsgKey)}</Chip></td>
                </tr>
              )
            })}
          </tbody>
        </TableFrame>
      )}
    </>
  )
}
