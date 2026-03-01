'use client'

import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { AuditRow } from '@/types'

interface Props {
  rows: AuditRow[]
}

type SortKey = keyof AuditRow
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 25

// ─── Formatting helpers ───────────────────────────────────────────────────────
const pct = (v: number) => (v > 0 ? `${(v * 100).toFixed(1)}%` : '—')
const num = (v: number) => (v > 0 ? v.toLocaleString() : '—')
const pos = (v: number) => (v > 0 ? v.toFixed(1) : '—')

function PriorityBadge({ score, level }: { score: number; level: AuditRow['priority_level'] }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold',
        level === 'High' && 'bg-red-500/15 text-red-400 border border-red-500/25',
        level === 'Medium' && 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
        level === 'Low' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
      )}
    >
      {score.toFixed(1)}
    </span>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-300 w-7 text-right">{value.toFixed(0)}</span>
      <div className="h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: AuditRow['data_source'] }) {
  return (
    <span
      className={clsx(
        'text-xs px-1.5 py-0.5 rounded',
        source === 'Both' && 'bg-indigo-500/15 text-indigo-400',
        source === 'GSC Only' && 'bg-sky-500/15 text-sky-400',
        source === 'Shopify Only' && 'bg-violet-500/15 text-violet-400'
      )}
    >
      {source}
    </span>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-slate-600 text-xs">↕</span>
  return (
    <span className="text-indigo-400 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>
  )
}

interface ColDef {
  key: SortKey
  label: string
  title?: string
  render: (row: AuditRow) => React.ReactNode
  align?: 'left' | 'right'
}

const COLUMNS: ColDef[] = [
  { key: 'rank', label: '#', render: (r) => r.rank, align: 'right' },
  {
    key: 'path',
    label: 'Page Path',
    render: (r) => (
      <a
        href={r.page}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate block max-w-[280px]"
        title={r.path}
      >
        {r.path}
      </a>
    ),
  },
  {
    key: 'priority_score',
    label: 'Priority',
    render: (r) => <PriorityBadge score={r.priority_score} level={r.priority_level} />,
    align: 'right',
  },
  // GSC
  { key: 'impressions', label: 'Impr.', title: 'GSC Impressions', render: (r) => num(r.impressions), align: 'right' },
  { key: 'clicks', label: 'Clicks', title: 'GSC Clicks', render: (r) => num(r.clicks), align: 'right' },
  { key: 'ctr', label: 'CTR', title: 'Click-Through Rate', render: (r) => pct(r.ctr), align: 'right' },
  { key: 'position', label: 'Pos.', title: 'Avg. Search Position', render: (r) => pos(r.position), align: 'right' },
  // Shopify
  { key: 'sessions', label: 'Sessions', title: 'Shopify Landing Sessions', render: (r) => num(r.sessions), align: 'right' },
  { key: 'bounce_rate', label: 'Bounce', title: 'Bounce Rate', render: (r) => pct(r.bounce_rate), align: 'right' },
  { key: 'conversion_rate', label: 'Conv.', title: 'Purchase Conversion Rate', render: (r) => pct(r.conversion_rate), align: 'right' },
  { key: 'added_to_cart_rate', label: 'ATC', title: 'Add-to-Cart Rate', render: (r) => pct(r.added_to_cart_rate), align: 'right' },
  { key: 'reached_checkout_rate', label: 'Checkout', title: 'Reached Checkout Rate', render: (r) => pct(r.reached_checkout_rate), align: 'right' },
  // Scores
  {
    key: 'seo_score',
    label: 'SEO Score',
    title: 'SEO Opportunity Score (0–100)',
    render: (r) => <ScoreBar value={r.seo_score} color="bg-sky-500" />,
  },
  {
    key: 'revenue_score',
    label: 'Rev. Score',
    title: 'Revenue Leakage Score (0–100)',
    render: (r) => <ScoreBar value={r.revenue_score} color="bg-violet-500" />,
  },
  {
    key: 'data_source',
    label: 'Source',
    render: (r) => <SourceBadge source={r.data_source} />,
  },
  {
    key: 'recommendation',
    label: 'Recommendation',
    render: (r) => (
      <span className="text-xs text-slate-400 leading-snug block max-w-[300px]" title={r.recommendation}>
        {r.recommendation}
      </span>
    ),
  },
]

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(rows: AuditRow[]) {
  const headers = [
    'Rank', 'Path', 'Page URL', 'Priority Score', 'Priority Level',
    'Impressions', 'Clicks', 'CTR', 'Avg Position',
    'Sessions', 'Bounce Rate', 'Conv. Rate', 'ATC Rate', 'Checkout Rate',
    'SEO Score', 'Revenue Score', 'Data Source', 'Recommendation',
  ]
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const csvRows = rows.map((r) =>
    [
      r.rank, escape(r.path), escape(r.page),
      r.priority_score, r.priority_level,
      r.impressions, r.clicks,
      (r.ctr * 100).toFixed(2) + '%', r.position.toFixed(1),
      r.sessions,
      (r.bounce_rate * 100).toFixed(2) + '%',
      (r.conversion_rate * 100).toFixed(2) + '%',
      (r.added_to_cart_rate * 100).toFixed(2) + '%',
      (r.reached_checkout_rate * 100).toFixed(2) + '%',
      r.seo_score, r.revenue_score,
      escape(r.data_source), escape(r.recommendation),
    ].join(',')
  )
  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AuditTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('priority_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('All')
  const [sourceFilter, setSourceFilter] = useState<string>('All')
  const [page, setPage] = useState(0)

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const filtered = useMemo(() => {
    let result = [...rows]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.path.toLowerCase().includes(q) ||
          r.recommendation.toLowerCase().includes(q)
      )
    }
    if (priorityFilter !== 'All')
      result = result.filter((r) => r.priority_level === priorityFilter)
    if (sourceFilter !== 'All')
      result = result.filter((r) => r.data_source === sourceFilter)

    result.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [rows, search, priorityFilter, sourceFilter, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const resetPage = () => setPage(0)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-800">
        <input
          type="text"
          placeholder="Search paths or recommendations…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage() }}
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); resetPage() }}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); resetPage() }}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option>All</option>
          <option>Both</option>
          <option>GSC Only</option>
          <option>Shopify Only</option>
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length.toLocaleString()} pages
        </span>

        <button
          onClick={() => exportCSV(filtered)}
          className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto thin-scroll">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  title={col.title ?? col.label}
                  className={clsx(
                    'px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors',
                    col.align === 'right' ? 'text-right' : 'text-left'
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="text-center py-12 text-slate-500 text-sm"
                >
                  No pages match your filters.
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={row.path}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-3 py-2 text-slate-200',
                        col.align === 'right' && 'text-right tabular-nums'
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} · showing{' '}
            {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
