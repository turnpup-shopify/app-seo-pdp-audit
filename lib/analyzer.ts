/**
 * Merges Shopify + GSC data and calculates SEO priority scores.
 *
 * Priority Score (0–100) = weighted blend of:
 *   • SEO Opportunity  — impressions × (1 – CTR) × position_weight
 *     → High impressions but low CTR + page-2 position = missed organic revenue
 *   • Revenue Leakage  — sessions × bounce_rate × (1 – conversion_rate)
 *     → Traffic landing but not converting = fixable with page improvements
 */

import type { AuditRow } from '@/types'
import { URL } from 'url'

// ─── Path utilities ───────────────────────────────────────────────────────────

function extractPath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    let path = parsed.pathname
    if (path !== '/') path = path.replace(/\/+$/, '')
    return path.toLowerCase()
  } catch {
    // rawUrl might already be a path
    const path = rawUrl.split('?')[0].replace(/\/+$/, '') || '/'
    return path.toLowerCase()
  }
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * Position multiplier: pages on page 2 (pos 11-20) have the highest
 * improvement potential — small content/link wins can jump them to page 1.
 */
function positionWeight(pos: number): number {
  if (pos <= 0) return 0
  if (pos <= 3) return 0.1    // Already in top 3, low headroom
  if (pos <= 10) return 0.6   // First page — optimize to reach top 3
  if (pos <= 20) return 1.0   // Page 2 — highest opportunity
  if (pos <= 50) return 0.7   // Reachable with effort
  return 0.3                   // Far out, lower ROI
}

function normalizeArray(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 50)
  return values.map((v) => ((v - min) / (max - min)) * 100)
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function generateRecommendation(row: Partial<AuditRow>): string {
  const tips: string[] = []
  const {
    impressions = 0,
    ctr = 0,
    position = 0,
    sessions = 0,
    bounce_rate = 0,
    conversion_rate = 0,
    added_to_cart_rate = 0,
  } = row

  // SEO signals
  if (impressions > 0 && ctr < 0.02) {
    tips.push('Low CTR — rewrite title tag & meta description')
  }
  if (position >= 4 && position <= 10 && impressions > 50) {
    tips.push(
      `Pos. ${position.toFixed(0)} — deepen content & build internal links to reach top 3`
    )
  } else if (position > 10 && position <= 20 && impressions > 50) {
    tips.push(
      `Pos. ${position.toFixed(0)} — strong page-2 opportunity; add depth, FAQ, and backlinks`
    )
  } else if (position > 20 && impressions > 100) {
    tips.push(
      `Pos. ${position.toFixed(0)} — needs keyword targeting, content depth, and page authority`
    )
  }

  // Shopify signals
  if (sessions > 20 && bounce_rate > 0.7) {
    tips.push(
      `High bounce (${(bounce_rate * 100).toFixed(0)}%) — improve relevance, load speed & above-fold content`
    )
  }
  if (sessions > 20 && conversion_rate < 0.01) {
    tips.push('Very low conversion — audit UX, pricing, trust signals & social proof')
  } else if (sessions > 20 && conversion_rate < 0.03) {
    tips.push('Below-avg conversion — A/B test CTA placement & product imagery')
  }
  if (sessions > 20 && added_to_cart_rate < 0.02) {
    tips.push(
      'Low add-to-cart rate — improve product presentation, scarcity signals & reviews'
    )
  }

  return tips.length ? tips.join(' · ') : 'Monitor — no critical issues detected'
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function analyzeData(
  gscData: Record<string, unknown>[],
  shopifyData: Record<string, unknown>[],
  minSessions = 0,
  minImpressions = 0
): AuditRow[] {
  const hasGSC = gscData.length > 0
  const hasShopify = shopifyData.length > 0

  // ── Index GSC by path ────────────────────────────────────────────────────
  const gscMap = new Map<string, Record<string, unknown>>()
  for (const row of gscData) {
    const impressions = Number(row.impressions ?? 0)
    if (impressions < minImpressions) continue
    const path = extractPath(String(row.page ?? ''))
    const existing = gscMap.get(path)
    if (!existing || impressions > Number(existing.impressions ?? 0)) {
      gscMap.set(path, { ...row, _path: path })
    }
  }

  // ── Index Shopify by path ────────────────────────────────────────────────
  const shopifyMap = new Map<string, Record<string, unknown>>()
  for (const row of shopifyData) {
    const sessions = Number(row.sessions ?? 0)
    if (sessions < minSessions) continue
    const rawPath = String(row.landing_page_path ?? '/')
    const path = (rawPath !== '/' ? rawPath.replace(/\/+$/, '') : '/').toLowerCase()
    const existing = shopifyMap.get(path)
    if (!existing || sessions > Number(existing.sessions ?? 0)) {
      shopifyMap.set(path, { ...row, _path: path })
    }
  }

  // ── Merge ────────────────────────────────────────────────────────────────
  const allPaths = new Set([...gscMap.keys(), ...shopifyMap.keys()])
  const records: Partial<AuditRow>[] = []

  for (const path of allPaths) {
    const gsc = gscMap.get(path)
    const shopify = shopifyMap.get(path)

    records.push({
      path,
      page: gsc ? String(gsc.page ?? path) : path,
      impressions: Number(gsc?.impressions ?? 0),
      clicks: Number(gsc?.clicks ?? 0),
      ctr: Number(gsc?.ctr ?? 0),
      position: Number(gsc?.position ?? 0),
      sessions: Number(shopify?.sessions ?? 0),
      conversion_rate: Number(shopify?.conversion_rate ?? 0),
      bounce_rate: Number(shopify?.bounce_rate ?? 0),
      added_to_cart_rate: Number(shopify?.added_to_cart_rate ?? 0),
      reached_checkout_rate: Number(shopify?.reached_checkout_rate ?? 0),
      completed_checkout_rate: Number(shopify?.completed_checkout_rate ?? 0),
      sessions_that_completed_checkout: Number(
        shopify?.sessions_that_completed_checkout ?? 0
      ),
      data_source:
        gsc && shopify ? 'Both' : gsc ? 'GSC Only' : 'Shopify Only',
    })
  }

  // ── Compute raw scores ───────────────────────────────────────────────────
  const seoRaws = records.map((r) => {
    const posW = positionWeight(r.position ?? 0)
    return (r.impressions ?? 0) * (1 - (r.ctr ?? 0)) * posW
  })

  const revenueRaws = records.map((r) => {
    return (
      (r.sessions ?? 0) *
      (r.bounce_rate ?? 0) *
      (1 - (r.conversion_rate ?? 0))
    )
  })

  const seoNorm = normalizeArray(seoRaws)
  const revenueNorm = normalizeArray(revenueRaws)

  // ── Assign scores & build final rows ────────────────────────────────────
  const finalRows: AuditRow[] = records.map((r, i) => {
    const seoScore = round1(seoNorm[i])
    const revenueScore = round1(revenueNorm[i])

    let priority: number
    if (hasGSC && hasShopify) {
      priority = round1(seoScore * 0.55 + revenueScore * 0.45)
    } else if (hasGSC) {
      priority = seoScore
    } else {
      priority = revenueScore
    }

    const priority_level: AuditRow['priority_level'] =
      priority >= 66 ? 'High' : priority >= 33 ? 'Medium' : 'Low'

    return {
      ...(r as Required<typeof r>),
      rank: 0,
      seo_score: seoScore,
      revenue_score: revenueScore,
      priority_score: priority,
      priority_level,
      recommendation: generateRecommendation({
        ...r,
        seo_score: seoScore,
        revenue_score: revenueScore,
      }),
    } as AuditRow
  })

  // ── Sort & rank ──────────────────────────────────────────────────────────
  finalRows.sort((a, b) => b.priority_score - a.priority_score)
  finalRows.forEach((r, i) => {
    r.rank = i + 1
  })

  return finalRows
}
