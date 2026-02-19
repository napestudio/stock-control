export interface SalesReportSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  saleCount: number;
  averageTicket: number;
}

export interface SalesReportRow {
  id: string;
  date: string;
  customer: string;
  itemCount: number;
  paymentMethod: string;
  total: number;
  status: string;
}

export interface StockReportSummary {
  totalIn: number;
  totalOut: number;
  totalAdjustments: number;
  netBalance: number;
}

export interface StockReportRow {
  id: string;
  date: string;
  product: string;
  sku: string;
  type: string;
  quantity: number;
  reason: string;
}

export interface ReportPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SalesReportResult {
  summary: SalesReportSummary;
  rows: SalesReportRow[];
  pagination: ReportPagination;
}

export interface StockReportResult {
  summary: StockReportSummary;
  rows: StockReportRow[];
  pagination: ReportPagination;
}

// ─── Statistics types ──────────────────────────────────────────────────────

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  saleCount: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  total: number;
}

export interface TopProduct {
  sku: string;
  name: string;
  revenue: number;
  unitsSold: number;
}

export interface StatisticsData {
  revenueTimeSeries: RevenueDataPoint[];
  paymentBreakdown: PaymentMethodBreakdown[];
  topProducts: TopProduct[];
}
