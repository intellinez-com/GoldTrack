
import { Purity } from "./types";

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
