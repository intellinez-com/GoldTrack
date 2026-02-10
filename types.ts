
export enum Purity {
  K24 = '24K',
  K22 = '22K',
  K18 = '18K',
  S999 = '999 Fine',
  S925 = '925 Sterling'
}

export enum InvestmentType {
  BAR = 'Bar',
  COIN = 'Coin',
  JEWELRY = 'Jewelry',
  ETF = 'ETF',
  SGB = 'Sovereign Gold Bond'
}

export type MetalType = 'gold' | 'silver';

export type InvestmentStatus = 'HOLD' | 'SOLD' | 'GIFTED';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface DataSource {
  id: string;
  name: string;
  url?: string;
  isRecommended?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  country?: string;
  currency?: string;
  sources?: DataSource[];
}

export interface Investment {
  id: string;
  userId: string;
  metal: MetalType;
  purity: Purity;
  type: InvestmentType;
  dateOfPurchase: string;
  weightInGrams: number;
  totalPricePaid: number;
  purchasePricePerGram: number;
  // ETF-specific fields (optional)
  units?: number; // number of ETF units
  navPerUnit?: number; // NAV per unit on purchase date (reference for metal exposure)
  purchasePricePerUnit?: number; // actual price paid per unit (can differ from NAV due to charges)
  status?: InvestmentStatus; // default: 'HOLD'
  soldAt?: string; // YYYY-MM-DD
  salePricePerGram?: number;
  saleTotalReceived?: number;
  giftedAt?: string; // YYYY-MM-DD
  giftedMarketValue?: number; // total market value saved at gift time
  giftedNotes?: string;
}

export interface PriceQuote {
  sourceName: string;
  price: number;
  url: string;
}

export interface MetalPriceData {
  metal: MetalType;
  pricePerGram: number;
  lastUpdated: string;
  currency: string;
  sources: GroundingSource[];
  quotes: PriceQuote[];
}

export interface HistoricalPricePoint {
  date: string;
  price24K: number;
  price22K: number;
}

export interface DailyPricePoint {
  date: string;
  price: number;
}

export interface GeopoliticalEvent {
  event_type: string;
  date: string;
  description: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

export interface ExpertReport {
  institution: string;
  date: string;
  summary_text: string;
  tone: 'Bullish' | 'Bearish' | 'Neutral';
  url?: string;
}

export interface MetalNarrative {
  sentiment_score: number; // 0-100
  expert_outlook: 'Bullish' | 'Bearish' | 'Neutral';
  summary: string;
  geopolitical_impact: 'Positive' | 'Negative' | 'Neutral';
  geo_bullets: string[];
  geo_modifier: number;
  reports: ExpertReport[];
  events: GeopoliticalEvent[];
  sources: GroundingSource[];
  last_updated: string;
}

export type Timeframe = '7D' | '30D' | '3M' | '1Y' | '5Y' | 'ALL';
export type AppTab = 'portfolio' | 'insights' | 'advisor';

export interface PerformanceStats {
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
}

export type AuthMode = 'login' | 'signup' | 'forgot-password';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' }
];

export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' }
];

// Advisor Types
export type AdvisorMode = 'LUMPSUM' | 'SIP';
export type AdvisorSignal = 'SELL_RISK_OFF' | 'STRONG_BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'WAIT_TRIM';

export interface AdvisorMetrics {
  delta50: number;
  delta200: number;
  goldenCross: boolean;
  deathCross: boolean;
  blockLumpsum: boolean;
}

export interface AdvisorResponse {
  signal: AdvisorSignal;
  investPctNow: number;
  allocationNowAmount: number | null;
  lumpSumAllowed: boolean;
  sipAllowed: boolean;
  targetExposurePct: number | null;
  trimPctOptional: string | null;
  metrics: AdvisorMetrics;
  message: string;
  nextAction: string;
}
