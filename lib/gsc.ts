/**
 * Google Search Console API client.
 *
 * Auth priority:
 *   1. GSC_SERVICE_ACCOUNT_JSON env var (inline JSON) — works on Vercel & locally
 *   2. GSC_CREDENTIALS_PATH file path               — local dev fallback
 */

import { google } from 'googleapis'
import * as fs from 'fs'

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
const PAGE_SIZE = 25_000 // GSC API max rows per request

export interface GSCRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

function buildAuth() {
  // Option A: inline JSON env var (preferred for Vercel)
  const inlineJson = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (inlineJson) {
    let credentials: object
    try {
      credentials = JSON.parse(inlineJson)
    } catch {
      throw new Error('GSC_SERVICE_ACCOUNT_JSON is not valid JSON.')
    }
    return new google.auth.GoogleAuth({ credentials, scopes: SCOPES })
  }

  // Option B: path to a JSON credentials file (service account or OAuth2)
  const credPath = process.env.GSC_CREDENTIALS_PATH
  if (credPath && fs.existsSync(credPath)) {
    return new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: SCOPES,
    })
  }

  throw new Error(
    'No GSC credentials found. Set GSC_SERVICE_ACCOUNT_JSON (recommended) ' +
      'or GSC_CREDENTIALS_PATH in your .env file.'
  )
}

export async function getGSCPageData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 10_000
): Promise<GSCRow[]> {
  const auth = buildAuth()
  const sc = google.searchconsole({ version: 'v1', auth })

  const allRows: GSCRow[] = []
  let startRow = 0

  while (true) {
    const res = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: Math.min(PAGE_SIZE, rowLimit - allRows.length),
        startRow,
        dataState: 'all',
      },
    })

    const rows = res.data.rows ?? []
    if (!rows.length) break

    for (const row of rows) {
      allRows.push({
        page: row.keys![0],
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      })
    }

    startRow += rows.length
    if (rows.length < PAGE_SIZE || allRows.length >= rowLimit) break
  }

  return allRows
}
