'use client'

import type { AnalysisSummary } from '@/types'

interface Props {
  summary: AnalysisSummary
}

interface CardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function Card({ label, value, sub, accent = 'text-white' }: CardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function SummaryCards({ summary }: Props) {
  const { start, end } = summary.date_range

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
      <Card
        label="Pages Analyzed"
        value={summary.total_pages.toLocaleString()}
        sub={`${start} → ${end}`}
      />
      <Card
        label="High Priority"
        value={summary.high_priority}
        sub="Score ≥ 66"
        accent="text-red-400"
      />
      <Card
        label="Medium Priority"
        value={summary.medium_priority}
        sub="Score 33–65"
        accent="text-amber-400"
      />
      <Card
        label="Low Priority"
        value={summary.low_priority}
        sub="Score < 33"
        accent="text-emerald-400"
      />
      <Card
        label="Avg Score"
        value={summary.avg_priority_score}
        sub="out of 100"
      />
      <Card
        label="Both Sources"
        value={summary.both_sources}
        sub="GSC + Shopify"
        accent="text-indigo-400"
      />
      <Card
        label="Single Source"
        value={summary.gsc_only + summary.shopify_only}
        sub={`${summary.gsc_only} GSC · ${summary.shopify_only} Shopify`}
        accent="text-slate-300"
      />
    </div>
  )
}
