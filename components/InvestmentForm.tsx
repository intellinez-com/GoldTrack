
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Info, Sparkles, Coins } from 'lucide-react';
import { Investment, Purity, InvestmentType, MetalType } from '../types';

interface InvestmentFormProps {
  onSave: (inv: Omit<Investment, 'userId'>) => void;
  onCancel: () => void;
  currentGoldPrice: number;
  currentSilverPrice: number;
}

const InvestmentForm: React.FC<InvestmentFormProps> = ({ onSave, onCancel, currentGoldPrice, currentSilverPrice }) => {
  const [metal, setMetal] = useState<MetalType>('gold');
  const [type, setType] = useState<InvestmentType>(InvestmentType.BAR);
  const [purity, setPurity] = useState<Purity>(Purity.K24);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState<string>('');
  const [totalPaid, setTotalPaid] = useState<string>('');
  const [pricePerGram, setPricePerGram] = useState<string>('');

  const availablePurities = useMemo(() => {
    if (metal === 'gold') {
      return [Purity.K24, Purity.K22, Purity.K18];
    } else {
      return [Purity.S999, Purity.S925];
    }
  }, [metal]);

  useEffect(() => {
    if (!availablePurities.includes(purity)) {
      setPurity(availablePurities[0]);
    }
  }, [metal, availablePurities, purity]);

  useEffect(() => {
    if (weight && totalPaid) {
      const perGram = parseFloat(totalPaid) / parseFloat(weight);
      setPricePerGram(perGram.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    } else {
      setPricePerGram('0.00');
    }
  }, [weight, totalPaid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight || !totalPaid) return;

    const newInv: Omit<Investment, 'userId'> = {
      id: crypto.randomUUID(),
      metal,
      purity,
      type,
      dateOfPurchase: date,
      weightInGrams: parseFloat(weight),
      totalPricePaid: parseFloat(totalPaid),
      purchasePricePerGram: parseFloat(totalPaid) / parseFloat(weight)
    };

    onSave(newInv);
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-slate-700/50">
      <div className={`absolute top-0 left-0 w-full h-1 ${metal === 'gold' ? 'gold-gradient' : 'bg-slate-400'}`}></div>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Record New Purchase</h2>
          <p className="text-xs text-slate-500 font-medium">Capture asset details in your vault</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Metal Selection Toggle */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Asset Commodity</label>
          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
            <button 
              type="button"
              onClick={() => setMetal('gold')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metal === 'gold' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Sparkles className="w-3 h-3" /> Gold
            </button>
            <button 
              type="button"
              onClick={() => setMetal('silver')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metal === 'silver' ? 'bg-slate-400 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Coins className="w-3 h-3" /> Silver
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Purity / Fineness</label>
            <div className="flex flex-wrap gap-2">
              {availablePurities.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurity(p)}
                  className={`py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${
                    purity === p 
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-inner' 
                    : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Investment Form</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as InvestmentType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
            >
              {Object.values(InvestmentType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Purchase Date</label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Mass (Grams)</label>
            <input 
              type="number"
              step="0.001"
              required
              placeholder="e.g. 10"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Consideration Paid</label>
            <input 
              type="number"
              step="1"
              required
              placeholder="Total amount"
              value={totalPaid}
              onChange={(e) => setTotalPaid(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 font-bold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Cost Basis</label>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-400 font-mono">
              {pricePerGram}/g
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            Calculations use live market rates. Net returns may be impacted by making charges or dealer premiums.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 py-4 px-4 rounded-2xl font-bold text-[10px] text-slate-500 hover:bg-slate-800 transition-colors uppercase tracking-widest"
          >
            Discard
          </button>
          <button 
            type="submit"
            className={`flex-[2] py-4 px-4 rounded-2xl ${metal === 'gold' ? 'gold-gradient' : 'bg-slate-500'} text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all`}
          >
            <Save className="w-4 h-4" />
            Archive Asset
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvestmentForm;
