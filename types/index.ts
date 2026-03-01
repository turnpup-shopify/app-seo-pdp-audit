export interface AuditRow {
  rank: number
  path: string
  page: string // full URL (from GSC) or constructed path

  // GSC metrics
  impressions: number
  clicks: number
  ctr: number       // 0–1 decimal
  position: number  // avg ranking position

  // Shopify metrics
  sessions: number
  conversion_rate: number     // 0–1 decimal
  bounce_rate: number         // 0–1 decimal
  added_to_cart_rate: number  // 0–1 decimal
  reached_checkout_rate: number
  completed_checkout_rate: number
  sessions_that_completed_checkout: number

  // Computed scores (0–100)
  seo_score: number
  revenue_score: number
  priority_score: number
  priority_level: 'High' | 'Medium' | 'Low'

  // Meta
  data_source: 'Both' | 'GSC Only' | 'Shopify Only'
  recommendation: string
}

export interface AnalysisSummary {
  total_pages: number
  high_priority: number
  medium_priority: number
  low_priority: number
  both_sources: number
  gsc_only: number
  shopify_only: number
  avg_priority_score: number
  date_range: { start: string; end: string }
  warnings: string[]
}

export interface AnalysisResult {
  rows: AuditRow[]
  summary: AnalysisSummary
}

export interface AnalysisConfig {
  days: number
  minSessions: number
  minImpressions: number
}
