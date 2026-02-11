import React, { useMemo, useState } from 'react';
import { X, Save, HandCoins, Info } from 'lucide-react';
import { Investment } from '../types';

interface SellInvestmentFormProps {
  investment: Investment;
  onCancel: () => void;
  onConfirm: (sale: { soldAt: string; saleTotalReceived: number; salePricePerGram: number }) => void;
  currencySymbol: string;
}

const SellInvestmentForm: React.FC<SellInvestmentFormProps> = ({ investment, onCancel, onConfirm, currencySymbol }) => {
  const [soldAt, setSoldAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [saleTotal, setSaleTotal] = useState<string>('');

  const derived = useMemo(() => {
    const total = parseFloat(saleTotal || '0');
    const ppg = investment.weightInGrams > 0 ? total / investment.weightInGrams : 0;
    return { total, ppg };
  }, [saleTotal, investment.weightInGrams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleTotal) return;
    if (!Number.isFinite(derived.total) || derived.total <= 0) return;
    if (!Number.isFinite(derived.ppg) || derived.ppg <= 0) return;
    onConfirm({
      soldAt,
      saleTotalReceived: derived.total,
      salePricePerGram: parseFloat(derived.ppg.toFixed(2))
    });
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-slate-700/50 max-h-[90vh] overflow-y-auto">
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-400" />
            Sell Asset
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Mark this holding as sold and record realized proceeds.
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
            {investment.weightInGrams.toFixed(2)}g
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sell Date</label>
            <input
              type="date"
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Received</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Total proceeds"
              value={saleTotal}
              onChange={(e) => setSaleTotal(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-slate-200 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Implied Price / g</label>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-300 font-mono">
              {currencySymbol}{derived.ppg ? derived.ppg.toFixed(2) : '0.00'}/g
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cost Basis</label>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-400 font-mono">
              {currencySymbol}{investment.purchasePricePerGram.toFixed(2)}/g
            </div>
          </div>
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            After selling, this entry will be excluded from active holdings and portfolio valuation charts.
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
            className="flex-[2] py-4 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            <Save className="w-4 h-4" />
            Confirm Sale
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellInvestmentForm;

