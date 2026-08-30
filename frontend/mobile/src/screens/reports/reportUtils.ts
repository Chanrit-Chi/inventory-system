import type { AnalyticsReportData } from '../../api/endpoints'

export type DateRangeMode = 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

export const DEFAULT_REPORT_DATA: AnalyticsReportData = {
  period: '30d',
  date_from: new Date(Date.now() - 29 * 86400000).toISOString(),
  date_to: new Date().toISOString(),
  revenue: 0,
  ordersCount: 0,
  avgTicket: 0,
  profit: 0,
  expenses: 0,
  netProfit: 0,
  topProducts: [],
  chartBars: [],
}

export function getPastDateStr(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000)
  return d.toISOString().split('T')[0]
}

export function getReportDateLabel(
  dateRange: DateRangeMode,
  singleDate: string,
  customFrom: string,
  customTo: string
): string {
  if (dateRange === 'single') return `Single Date (${singleDate})`
  if (dateRange === 'custom') {
    return `${new Date(customFrom).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${new Date(customTo).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`
  }
  if (dateRange === 'today') return 'Today'
  if (dateRange === '7d') return 'Last 7 Days'
  if (dateRange === '30d') return 'Last 30 Days'
  if (dateRange === 'year') return 'This Year'
  return 'All Time'
}
