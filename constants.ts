
import { Purity, DataSource } from "./types";

export const PURITY_MULTIPLIERS: Record<Purity, number> = {
  [Purity.K24]: 1.0,
  [Purity.K22]: 0.9167,
  [Purity.K18]: 0.75,
  [Purity.S999]: 1.0,
  [Purity.S925]: 0.925
};

export const COLORS = {
  GOLD: '#f59e0b',
  SILVER: '#94a3b8',
  SUCCESS: '#10b981',
  DANGER: '#ef4444',
  BG_DARK: '#0f172a',
  CARD_BG: 'rgba(30, 41, 59, 0.7)'
};

// Default recommended price data sources by currency
export const RECOMMENDED_SOURCES_BY_CURRENCY: Record<string, DataSource[]> = {
  INR: [
    { id: 'goodreturns', name: 'GoodReturns.in', url: 'https://www.goodreturns.in/gold-rates/', isRecommended: true },
    { id: 'mcx', name: 'MCX India', url: 'https://www.mcxindia.com/', isRecommended: true },
    { id: 'ibja', name: 'IBJA (India Bullion)', url: 'https://ibja.co/', isRecommended: true },
    { id: 'groww', name: 'Groww.in', url: 'https://groww.in/gold-rates', isRecommended: true },
    { id: 'bajaj', name: 'Bajaj Finserv', url: 'https://www.bajajfinservmarkets.in/gold-rates', isRecommended: false },
    { id: 'policybazaar', name: 'PolicyBazaar', url: 'https://www.policybazaar.com/gold-rate/', isRecommended: false },
  ],
  USD: [
    { id: 'kitco', name: 'Kitco', url: 'https://www.kitco.com/', isRecommended: true },
    { id: 'goldprice', name: 'GoldPrice.org', url: 'https://goldprice.org/', isRecommended: true },
    { id: 'apmex', name: 'APMEX', url: 'https://www.apmex.com/', isRecommended: false },
  ],
  AED: [
    { id: 'dubairates', name: 'Dubai Gold & Jewellery Group', url: 'https://www.dgjg.ae/', isRecommended: true },
    { id: 'goldprice_ae', name: 'GoldPrice.org UAE', url: 'https://goldprice.org/uae-gold-price.html', isRecommended: true },
  ],
  GBP: [
    { id: 'bullionbypost', name: 'BullionByPost', url: 'https://www.bullionbypost.co.uk/', isRecommended: true },
    { id: 'goldprice_uk', name: 'GoldPrice.org UK', url: 'https://goldprice.org/uk-gold-price.html', isRecommended: true },
  ],
  EUR: [
    { id: 'gold_de', name: 'Gold.de', url: 'https://www.gold.de/', isRecommended: true },
    { id: 'goldprice_eu', name: 'GoldPrice.org EU', url: 'https://goldprice.org/eu-gold-price.html', isRecommended: true },
  ],
};
