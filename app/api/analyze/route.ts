import { NextRequest, NextResponse } from 'next/server'
import { getShopifyLandingPageData } from '@/lib/shopify'
import { getGSCPageData } from '@/lib/gsc'
import { analyzeData } from '@/lib/analyzer'
import type { AnalysisResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds — increase on Vercel Pro if needed

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date()
  end.setDate(end.getDate() - 1) // yesterday (GSC data can lag 1-2 days)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30'), 7), 90)
  const minSessions = Math.max(parseInt(searchParams.get('minSessions') || '0'), 0)
  const minImpressions = Math.max(
    parseInt(searchParams.get('minImpressions') || '0'),
    0
  )

  const { start, end } = getDateRange(days)
  const warnings: string[] = []

  // ── Fetch Shopify ─────────────────────────────────────────────────────────
  let shopifyData: Record<string, string | number | null>[] = []
  const shopUrl = process.env.SHOPIFY_SHOP_URL?.trim()
  const shopToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim()
  const shopVersion = process.env.SHOPIFY_API_VERSION?.trim() || '2024-10'

  if (shopUrl && shopToken) {
    try {
      shopifyData = await getShopifyLandingPageData(
        shopUrl,
        shopToken,
        shopVersion,
        days
      )
    } catch (err: unknown) {
      warnings.push(`Shopify: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    warnings.push(
      'Shopify not configured — set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN'
    )
  }

  // ── Fetch GSC ─────────────────────────────────────────────────────────────
  let gscData: Awaited<ReturnType<typeof getGSCPageData>> = []
  const gscSiteUrl = process.env.GSC_SITE_URL?.trim()

  if (gscSiteUrl) {
    try {
      gscData = await getGSCPageData(gscSiteUrl, start, end)
    } catch (err: unknown) {
      warnings.push(`GSC: ${err instanceof Error ? err.message : String(err)}`)
    }
  } else {
    warnings.push('GSC not configured — set GSC_SITE_URL and GSC_SERVICE_ACCOUNT_JSON')
  }

  // ── Guard: at least one data source must have data ────────────────────────
  if (!gscData.length && !shopifyData.length) {
    return NextResponse.json(
      {
        error:
          'No data returned from either source. Check your credentials and date range.',
        warnings,
      },
      { status: 422 }
    )
  }

  // ── Analyze ───────────────────────────────────────────────────────────────
  const rows = analyzeData(
    gscData as unknown as Record<string, unknown>[],
    shopifyData,
    minSessions,
    minImpressions
  )

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.priority_level] = (acc[r.priority_level] ?? 0) + 1
      acc[r.data_source] = (acc[r.data_source] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const result: AnalysisResult = {
    rows,
    summary: {
      total_pages: rows.length,
      high_priority: counts['High'] ?? 0,
      medium_priority: counts['Medium'] ?? 0,
      low_priority: counts['Low'] ?? 0,
      both_sources: counts['Both'] ?? 0,
      gsc_only: counts['GSC Only'] ?? 0,
      shopify_only: counts['Shopify Only'] ?? 0,
      avg_priority_score:
        rows.length
          ? Math.round(
              (rows.reduce((s, r) => s + r.priority_score, 0) / rows.length) * 10
            ) / 10
          : 0,
      date_range: { start, end },
      warnings,
    },
  }

  return NextResponse.json(result)
}
