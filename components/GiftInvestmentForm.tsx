import React, { useMemo, useState } from 'react';
import { Gift, Info, Save, X } from 'lucide-react';
import { Investment } from '../types';

interface GiftInvestmentFormProps {
  investment: Investment;
  currencySymbol: string;
  defaultMarketValue: number;
  onCancel: () => void;
  onConfirm: (gift: { giftedAt: string; giftedMarketValue: number; giftedNotes?: string }) => void;
}

const GiftInvestmentForm: React.FC<GiftInvestmentFormProps> = ({ investment, currencySymbol, defaultMarketValue, onCancel, onConfirm }) => {
  const [giftedAt, setGiftedAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [marketValue, setMarketValue] = useState<string>(defaultMarketValue > 0 ? String(Math.round(defaultMarketValue)) : '');
  const [notes, setNotes] = useState<string>('');

  const parsed = useMemo(() => {
    const v = parseFloat(marketValue || '0');
    return { value: v };
  }, [marketValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(parsed.value) || parsed.value <= 0) return;
    onConfirm({ giftedAt, giftedMarketValue: parsed.value, giftedNotes: notes.trim() ? notes.trim() : undefined });
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-slate-700/50 max-h-[90vh] overflow-y-auto">
      <div className="absolute top-0 left-0 w-full h-1 bg-violet-500"></div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Gift className="w-5 h-5 text-violet-400" />
            Gift Asset
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Mark this holding as gifted (transferred out) and optionally save its market value.
          </p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 mb-6">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Selected Asset</p>
        <div className="flex items-center justify-between gap-4">
          <div className="text-slate-200 font-bold uppercase text-xs">
            {investment.metal} {investment.type} <span className="text-slate-500 font-black ml-2">{investment.purity}</span>
          </div>
          <div className="text-slate-300 font-mono text-xs">
            {investment.weightInGrams.toFixed(4)}g
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gift Date</label>
            <input
              type="date"
              value={giftedAt}
              onChange={(e) => setGiftedAt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Market Value (saved)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Value at gifting"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-200 font-bold"
            />
            <p className="text-[10px] text-slate-600 mt-2 font-medium">
              Prefilled from current valuation. You can edit it.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Notes (optional)</label>
          <input
            type="text"
            placeholder="e.g. Gifted to family"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all text-slate-200"
          />
        </div>

        <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            Gifted assets will be excluded from active holdings and portfolio valuation. Realized Profit remains SOLD-only.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 px-4 rounded-2xl font-bold text-[10px] text-slate-500 hover:bg-slate-800 transition-colors uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-[2] py-4 px-4 rounded-2xl bg-violet-500 hover:bg-violet-400 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            <Save className="w-4 h-4" />
            Confirm Gift
          </button>
        </div>

        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">
          Saved market value: {currencySymbol}{parsed.value ? parsed.value.toLocaleString() : '0'}
        </div>
      </form>
    </div>
  );
};

export default GiftInvestmentForm;

