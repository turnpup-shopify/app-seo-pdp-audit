'use client'

import { useState, useCallback } from 'react'
import SummaryCards from './SummaryCards'
import AuditTable from './AuditTable'
import type { AnalysisResult, AnalysisConfig } from '@/types'

const DEFAULT_CONFIG: AnalysisConfig = {
  days: 30,
  minSessions: 0,
  minImpressions: 0,
}

export default function AuditDashboard() {
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        days: String(config.days),
        minSessions: String(config.minSessions),
        minImpressions: String(config.minImpressions),
      })
      const res = await fetch(`/api/analyze?${params}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setResult(data as AnalysisResult)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [config])

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              SEO PDP Audit
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Shopify sessions + Google Search Console · priority scoring
            </p>
          </div>
          {result && (
            <span className="text-xs text-slate-500 hidden sm:block">
              {result.summary.date_range.start} → {result.summary.date_range.end}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* ── Settings panel ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Configuration
          </h2>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date range */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Date Range</span>
              <select
                value={config.days}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, days: Number(e.target.value) }))
                }
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </label>

            {/* Min sessions */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Min Sessions</span>
              <input
                type="number"
                min={0}
                value={config.minSessions}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, minSessions: Number(e.target.value) }))
                }
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            {/* Min impressions */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Min Impressions</span>
              <input
                type="number"
                min={0}
                value={config.minImpressions}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    minImpressions: Number(e.target.value),
                  }))
                }
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            {/* CTA */}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-6 py-2 text-sm font-semibold transition-colors"
            >
              {loading ? 'Analyzing…' : result ? 'Re-run' : 'Run Analysis'}
            </button>
          </div>

          {/* Scoring legend */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-5 text-xs text-slate-400">
            <div>
              <span className="font-medium text-slate-300">Priority Score</span> =
              55% SEO Opportunity + 45% Revenue Leakage (both normalized 0–100)
            </div>
            <div>
              <span className="text-sky-400">SEO</span> = impressions × (1 − CTR) × position weight
            </div>
            <div>
              <span className="text-violet-400">Revenue</span> = sessions × bounce rate × (1 − conversion rate)
            </div>
          </div>
        </div>

        {/* ── Warnings ────────────────────────────────────────────────────── */}
        {result?.summary.warnings.length ? (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 space-y-1">
            {result.summary.warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-400">
                ⚠ {w}
              </p>
            ))}
          </div>
        ) : null}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* ── Loading spinner ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-sm">
              Fetching data from Shopify and Google Search Console…
            </p>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {result && !loading && (
          <>
            <SummaryCards summary={result.summary} />
            <AuditTable rows={result.rows} />
          </>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
            <div className="text-5xl">📊</div>
            <p className="text-base font-medium text-slate-400">
              Configure and run your first analysis
            </p>
            <p className="text-sm text-center max-w-md">
              Set your date range and minimum thresholds above, then click{' '}
              <strong className="text-slate-300">Run Analysis</strong> to fetch
              live data from Shopify and Google Search Console.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
