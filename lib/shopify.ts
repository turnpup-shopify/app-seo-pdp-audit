/**
 * Shopify GraphQL / ShopifyQL client.
 * Executes a ShopifyQL query via the Admin GraphQL API and returns typed rows.
 */

const SHOPIFYQL_GQL = `
  query shopifyqlQuery($q: String!) {
    shopifyqlQuery(query: $q) {
      ... on TableResponse {
        tableData {
          rowData
          columns {
            name
            dataType
          }
        }
      }
      parseErrors {
        code
        message
        range {
          start { line column }
          end   { line column }
        }
      }
    }
  }
`

function buildQuery(startDate: string, endDate: string): string {
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
    DURING ${startDate}:${endDate}
    ORDER BY sessions DESC
  `
}

function castValue(
  value: string | null,
  dataType: string
): string | number | null {
  if (value === null || value === '') return null
  const dt = dataType.toLowerCase()
  if (
    ['float', 'decimal', 'percentage', 'rate', 'money'].includes(dt)
  ) {
    const n = parseFloat(value)
    return isNaN(n) ? null : n
  }
  if (['int', 'integer', 'count'].includes(dt)) {
    const n = parseInt(value, 10)
    return isNaN(n) ? null : n
  }
  return value
}

export async function getShopifyLandingPageData(
  shopUrl: string,
  accessToken: string,
  apiVersion: string,
  startDate: string,
  endDate: string
): Promise<Record<string, string | number | null>[]> {
  const endpoint = `https://${shopUrl}/admin/api/${apiVersion}/graphql.json`
  const query = buildQuery(startDate, endDate)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: SHOPIFYQL_GQL, variables: { q: query } }),
  })

  if (response.status === 401) {
    throw new Error('Shopify authentication failed — check SHOPIFY_ACCESS_TOKEN.')
  }
  if (response.status === 404) {
    throw new Error(
      `Shopify endpoint not found — check SHOPIFY_SHOP_URL: "${shopUrl}"`
    )
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

  if (qlResult?.parseErrors?.length) {
    const msgs = qlResult.parseErrors
      .map((e: { message: string }) => e.message)
      .join('; ')
    throw new Error(`ShopifyQL parse error: ${msgs}`)
  }

  const tableData = qlResult?.tableData
  if (!tableData?.columns?.length || !tableData?.rowData?.length) return []

  const columns: Array<{ name: string; dataType: string }> = tableData.columns
  const rows: Array<Array<string | null>> = tableData.rowData

  return rows.map((row) => {
    const record: Record<string, string | number | null> = {}
    columns.forEach((col, i) => {
      record[col.name] = castValue(row[i] ?? null, col.dataType)
    })
    return record
  })
}
