/**
 * Shopify GraphQL / ShopifyQL client.
 * Updated for API 2025-10:
 *   - No more `... on TableResponse` fragment — response is ShopifyqlQueryResponse directly
 *   - `rowData` → `rows` (now a JSON scalar returning array of objects, not arrays)
 *   - `parseErrors` is now a list of strings, not objects
 *   - Named date ranges: last_30_days/last_7_days removed; use last_month/last_week/last_quarter etc.
 */

const SHOPIFYQL_GQL = `
  query shopifyqlQuery($q: String!) {
    shopifyqlQuery(query: $q) {
      tableData {
        columns {
          name
          dataType
        }
        rows
      }
      parseErrors
    }
  }
`

/**
 * Map a number of days to the closest valid ShopifyQL named date period.
 * As of 2025-10, explicit date ranges (YYYY-MM-DD) and last_N_days are unsupported.
 */
function daysToShopifyPeriod(days: number): string {
  if (days <= 7)  return 'last_week'
  if (days <= 30) return 'last_month'
  if (days <= 90) return 'last_quarter'
  return 'last_year'
}

function buildQuery(days: number): string {
  const period = daysToShopifyPeriod(days)
  return `
    FROM sessions
    SHOW
      sessions,
      conversion_rate,
      bounce_rate,
      added_to_cart_rate,
      reached_checkout_rate,
      completed_checkout_rate,
      sessions_that_completed_checkout
    WHERE (
      landing_page_url NOT CONTAINS 'checkout'
      AND landing_page_url NOT CONTAINS 'retextion'
      AND landing_page_url NOT CONTAINS 'account'
      AND landing_page_url NOT CONTAINS 'order'
    )
    GROUP BY landing_page_path
    DURING ${period}
    ORDER BY sessions DESC
  `
}

function castValue(
  value: string | number | null,
  dataType: string
): string | number | null {
  if (value === null || value === '') return null
  const dt = dataType.toLowerCase()
  if (['float', 'decimal', 'percentage', 'rate', 'money'].includes(dt)) {
    const n = parseFloat(String(value))
    return isNaN(n) ? null : n
  }
  if (['int', 'integer', 'count'].includes(dt)) {
    const n = parseInt(String(value), 10)
    return isNaN(n) ? null : n
  }
  return value
}

export async function getShopifyLandingPageData(
  shopUrl: string,
  accessToken: string,
  apiVersion: string,
  days: number
): Promise<Record<string, string | number | null>[]> {
  const endpoint = `https://${shopUrl}/admin/api/${apiVersion}/graphql.json`
  const shopifyqlQuery = buildQuery(days)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: SHOPIFYQL_GQL, variables: { q: shopifyqlQuery } }),
  })

  if (response.status === 401) {
    throw new Error('Shopify authentication failed — check SHOPIFY_ACCESS_TOKEN.')
  }
  if (response.status === 404) {
    throw new Error(`Shopify endpoint not found — check SHOPIFY_SHOP_URL: "${shopUrl}"`)
  }
  if (!response.ok) {
    throw new Error(`Shopify API error ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors?.length) {
    const msgs = data.errors.map((e: { message: string }) => e.message).join('; ')
    throw new Error(`Shopify GraphQL error: ${msgs}`)
  }

  const qlResult = data?.data?.shopifyqlQuery

  // parseErrors is now a list of strings
  if (qlResult?.parseErrors?.length) {
    throw new Error(`ShopifyQL error: ${qlResult.parseErrors.join('; ')}`)
  }

  const tableData = qlResult?.tableData
  if (!tableData?.columns?.length || !tableData?.rows?.length) return []

  const columns: Array<{ name: string; dataType: string }> = tableData.columns
  // rows is now an array of JSON objects (not array of arrays)
  const rows: Array<Record<string, string | number | null>> = tableData.rows

  return rows.map((row) => {
    const record: Record<string, string | number | null> = {}
    for (const col of columns) {
      record[col.name] = castValue(row[col.name] ?? null, col.dataType)
    }
    return record
  })
}
