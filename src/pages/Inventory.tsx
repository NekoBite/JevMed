import { useMemo, useState } from 'react'
import { useApp } from '@/lib/app-context'
import {
  PageHeading, TableFrame, Chip, StatTile, Select, SearchInput,
  EmptyState, Card, CardHeader, Banner, StatusDot,
} from '@/components/ui'
import { db, inventoryTotals, stockState, stockValue, daysUntil } from '@/lib/data'
import { money, num, shortDate } from '@/lib/format'
import type { MsgKey } from '@/i18n'
import type { StockState } from '@/lib/data'

const STATE_TONE: Record<StockState, 'ok' | 'warn' | 'danger'> = {
  ok: 'ok', low: 'warn', expiring: 'warn', out: 'danger', expired: 'danger',
}
const CATEGORIES = ['pharmaceutical', 'consumable', 'reagent', 'device'] as const
const STATES = ['ok', 'low', 'out', 'expiring', 'expired'] as const

export default function Inventory() {
  const { t, tri, locale } = useApp()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [state, setState] = useState('all')

  const totals = inventoryTotals()

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.inventory
      .map((i) => ({ item: i, state: stockState(i) }))
      .filter(({ item, state: s }) => {
        if (cat !== 'all' && item.category !== cat) return false
        if (state !== 'all' && s !== state) return false
        if (!needle) return true
        const hay = [item.sku, item.lot, item.gtin, item.name.en, item.name['zh-Hant'], item.name['zh-Hans']]
          .join(' ').toLowerCase()
        return hay.includes(needle)
      })
      // Most urgent first — a stock page that opens on "everything fine" wastes
      // the one glance a busy pharmacist gives it.
      .sort((a, b) => {
        const rank: Record<StockState, number> = { expired: 0, out: 1, expiring: 2, low: 3, ok: 4 }
        return rank[a.state] - rank[b.state] || a.item.expiry.localeCompare(b.item.expiry)
      })
  }, [q, cat, state])

  return (
    <>
      <PageHeading title={t('inv.title')} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatTile label={t('inv.kpi.lines')} value={num(totals.lines, locale)} tone="info" />
        <StatTile label={t('inv.kpi.value')} value={money(totals.value, locale)} />
        <StatTile label={t('inv.kpi.belowReorder')} value={num(totals.belowReorder, locale)}
          tone={totals.belowReorder > 0 ? 'warn' : 'ok'} />
        <StatTile label={t('inv.kpi.expiring')} value={num(totals.expiring, locale)}
          sub={totals.expired > 0 ? `${num(totals.expired, locale)} ${t('inv.state.expired')}` : undefined}
          tone={totals.expired > 0 ? 'danger' : totals.expiring > 0 ? 'warn' : 'ok'} />
      </div>

      <div className="mb-6"><Banner tone="info">{t('inv.lotNote')}</Banner></div>

      <Card className="mb-6">
        <CardHeader title={t('common.search')} />
        <div className="grid gap-4 md:grid-cols-3">
          <SearchInput id="iv-q" label={t('common.search')} value={q} onChange={setQ} />
          <Select id="iv-cat" label={t('inv.filter.category')} value={cat} onChange={setCat}
            options={[{ value: 'all', label: t('common.all') },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`inv.cat.${c}` as MsgKey) }))]} />
          <Select id="iv-state" label={t('inv.filter.state')} value={state} onChange={setState}
            options={[{ value: 'all', label: t('common.all') },
              ...STATES.map((s) => ({ value: s, label: t(`inv.state.${s}` as MsgKey) }))]} />
        </div>
        <p className="text-sm text-ink-soft mt-4" role="status">
          {t('common.showing')} {rows.length} {t('common.of')} {db.inventory.length} {t('common.records')}
        </p>
      </Card>

      {rows.length === 0 ? (
        <div className="jm-card"><EmptyState title={t('common.noResults')} hint={t('common.noResultsHint')} /></div>
      ) : (
        <TableFrame caption={t('inv.title')} minWidth="min-w-[82rem]">
          <thead>
            <tr>
              <th scope="col">{t('inv.col.item')}</th>
              <th scope="col">{t('inv.col.category')}</th>
              <th scope="col">{t('inv.col.onHand')}</th>
              <th scope="col">{t('inv.col.reorder')}</th>
              <th scope="col">{t('inv.col.onOrder')}</th>
              <th scope="col">{t('inv.col.lot')}</th>
              <th scope="col">{t('inv.col.expiry')}</th>
              <th scope="col">{t('inv.col.supplier')}</th>
              <th scope="col">{t('inv.col.value')}</th>
              <th scope="col">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item: i, state: s }) => {
              const dLeft = daysUntil(i.expiry)
              return (
                <tr key={i.sku}>
                  <td className="min-w-[14rem]">
                    <div className="font-semibold">{tri(i.name)}</div>
                    <div className="text-sm text-ink-faint font-mono">{i.sku} · {i.unit}</div>
                    {i.controlled && <div className="mt-1.5"><Chip tone="danger">{t('inv.controlled')}</Chip></div>}
                  </td>
                  <td className="whitespace-nowrap">{t(`inv.cat.${i.category}` as MsgKey)}</td>
                  <td className="tabular-nums font-semibold text-lg">{num(i.onHand, locale)}</td>
                  <td className="tabular-nums text-ink-soft">{num(i.reorderPoint, locale)}</td>
                  <td className="tabular-nums text-ink-soft">{i.onOrder > 0 ? num(i.onOrder, locale) : '—'}</td>
                  <td className="font-mono text-sm whitespace-nowrap">{i.lot}</td>
                  <td className="tabular-nums whitespace-nowrap">
                    {shortDate(i.expiry, locale)}
                    <div className={`text-sm ${dLeft < 0 ? 'text-danger font-semibold' : 'text-ink-faint'}`}>
                      {dLeft < 0 ? `−${num(-dLeft, locale)}d` : `${num(dLeft, locale)}d`}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{tri(i.supplier)}<div className="text-sm text-ink-faint">{i.storage}</div></td>
                  <td className="tabular-nums whitespace-nowrap">{money(stockValue(i), locale)}</td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <StatusDot tone={STATE_TONE[s]} />
                      <Chip tone={STATE_TONE[s]}>{t(`inv.state.${s}` as MsgKey)}</Chip>
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
