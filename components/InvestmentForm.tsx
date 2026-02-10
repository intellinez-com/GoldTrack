
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Info, Sparkles, Coins } from 'lucide-react';
import { DailyPricePoint, Investment, Purity, InvestmentType, MetalType } from '../types';
import { getHistoricalPriceData } from '../services/historicalPriceService';

interface InvestmentFormProps {
  onSave: (inv: Omit<Investment, 'userId'>) => void;
  onCancel: () => void;
  currentGoldPrice: number;
  currentSilverPrice: number;
  currencyCode: string;
  currencySymbol: string;
  mode?: 'create' | 'edit';
  initialInvestment?: Investment;
}

const InvestmentForm: React.FC<InvestmentFormProps> = ({ onSave, onCancel, currentGoldPrice, currentSilverPrice, currencyCode, currencySymbol, mode = 'create', initialInvestment }) => {
  const [metal, setMetal] = useState<MetalType>('gold');
  const [type, setType] = useState<InvestmentType>(InvestmentType.BAR);
  const [purity, setPurity] = useState<Purity>(Purity.K24);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState<string>('');
  const [totalPaid, setTotalPaid] = useState<string>('');
  const [pricePerGram, setPricePerGram] = useState<string>('');
  const [etfUnits, setEtfUnits] = useState<string>('');
  const [etfNavPerUnit, setEtfNavPerUnit] = useState<string>('');
  const [etfPricePerUnit, setEtfPricePerUnit] = useState<string>('');
  const [etfDerivedGrams, setEtfDerivedGrams] = useState<number | null>(null);
  const [etfDeriving, setEtfDeriving] = useState(false);
  const parsePositive = (value: string): number | null => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  useEffect(() => {
    if (mode !== 'edit' || !initialInvestment) return;
    setMetal(initialInvestment.metal);
    setType(initialInvestment.type);
    setPurity(initialInvestment.purity);
    setDate(initialInvestment.dateOfPurchase);
    setWeight(String(initialInvestment.weightInGrams));
    setTotalPaid(String(initialInvestment.totalPricePaid));
    setEtfUnits(initialInvestment.units != null ? String(initialInvestment.units) : '');
    setEtfNavPerUnit(initialInvestment.navPerUnit != null ? String(initialInvestment.navPerUnit) : '');
    setEtfPricePerUnit(initialInvestment.purchasePricePerUnit != null ? String(initialInvestment.purchasePricePerUnit) : '');
  }, [mode, initialInvestment]);

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

  const isETF = type === InvestmentType.ETF;

  // Lock purity for ETFs: gold ETF assumed 24K, silver ETF assumed 999
  useEffect(() => {
    if (!isETF) return;
    if (metal === 'gold') setPurity(Purity.K24);
    else setPurity(Purity.S999);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isETF, metal]);

  useEffect(() => {
    if (weight && totalPaid) {
      const total = parsePositive(totalPaid);
      const grams = parsePositive(weight);
      if (total && grams) {
        const perGram = total / grams;
        setPricePerGram(perGram.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
      } else {
        setPricePerGram('0.00');
      }
    } else {
      setPricePerGram('0.00');
    }
  }, [weight, totalPaid]);

  const getSpotPriceOnOrBefore = (series: DailyPricePoint[], purchaseDate: string): number | null => {
    if (!series || series.length === 0) return null;
    // exact match
    const exact = series.find(p => p.date === purchaseDate);
    if (exact) return exact.price;
    // nearest prior
    const prior = [...series].reverse().find(p => p.date <= purchaseDate);
    return prior ? prior.price : null;
  };

  const deriveEtfMetalEquivalentGrams = async (opts: { metal: MetalType; purchaseDate: string; units: number; navPerUnit: number }) => {
    const { metal, purchaseDate, units, navPerUnit } = opts;
    const totalNavValue = units * navPerUnit;

    const today = new Date().toISOString().split('T')[0];
    const diffDays = Math.max(
      30,
      Math.min(
        365 * 5,
        Math.floor((new Date(today).getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)) + 7
      )
    );

    try {
      const series = await getHistoricalPriceData(metal, currencyCode, diffDays, false);
      const spot = getSpotPriceOnOrBefore(series, purchaseDate);
      const spotFallback = metal === 'gold' ? currentGoldPrice : currentSilverPrice;
      const spotToUse = spot && spot > 0 ? spot : spotFallback;
      if (!spotToUse || spotToUse <= 0) return null;
      return totalNavValue / spotToUse; // grams-equivalent exposure
    } catch {
      const spotFallback = metal === 'gold' ? currentGoldPrice : currentSilverPrice;
      if (!spotFallback || spotFallback <= 0) return null;
      return totalNavValue / spotFallback;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isETF) {
      if (!etfUnits || !etfNavPerUnit || !etfPricePerUnit) return;
    } else {
      if (!weight || !totalPaid) return;
    }

    let finalWeight = parsePositive(weight);
    let finalTotalPaid = parsePositive(totalPaid);
    let finalPurchasePpg = (finalTotalPaid && finalWeight) ? (finalTotalPaid / finalWeight) : null;
    let units: number | undefined;
    let navPerUnit: number | undefined;
    let purchasePricePerUnit: number | undefined;

    if (isETF) {
      units = parsePositive(etfUnits) ?? undefined;
      navPerUnit = parsePositive(etfNavPerUnit) ?? undefined;
      purchasePricePerUnit = parsePositive(etfPricePerUnit) ?? undefined;
      if (!units || !navPerUnit || !purchasePricePerUnit) return;

      finalTotalPaid = units * purchasePricePerUnit;

      setEtfDeriving(true);
      const grams = await deriveEtfMetalEquivalentGrams({ metal, purchaseDate: date, units, navPerUnit });
      setEtfDeriving(false);
      setEtfDerivedGrams(grams);
      if (!grams || grams <= 0) return;

      finalWeight = grams;
      finalPurchasePpg = finalTotalPaid / grams;
    }
    if (!finalWeight || !finalTotalPaid || !finalPurchasePpg) return;
    if (!Number.isFinite(finalWeight) || !Number.isFinite(finalTotalPaid) || !Number.isFinite(finalPurchasePpg)) return;

    const newInv: Omit<Investment, 'userId'> = {
      id: mode === 'edit' && initialInvestment?.id ? initialInvestment.id : crypto.randomUUID(),
      metal,
      purity,
      type,
      dateOfPurchase: date,
      weightInGrams: finalWeight,
      totalPricePaid: finalTotalPaid,
      purchasePricePerGram: finalPurchasePpg,
      units,
      navPerUnit,
      purchasePricePerUnit,
      status: initialInvestment?.status || 'HOLD'
    };

    onSave(newInv);
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-slate-700/50">
      <div className={`absolute top-0 left-0 w-full h-1 ${metal === 'gold' ? 'gold-gradient' : 'bg-slate-400'}`}></div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{mode === 'edit' ? 'Edit Ledger Entry' : 'Record New Purchase'}</h2>
          <p className="text-xs text-slate-500 font-medium">{mode === 'edit' ? 'Update asset details in your vault' : 'Capture asset details in your vault'}</p>
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
                  onClick={() => !isETF && setPurity(p)}
                  className={`py-2 px-3 rounded-lg border text-[10px] font-black transition-all ${purity === p
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-inner'
                      : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
                    } ${isETF ? 'opacity-60 cursor-not-allowed' : ''}`}
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
          {isETF ? (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Units</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                placeholder="e.g. 12.5"
                value={etfUnits}
                onChange={(e) => setEtfUnits(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Mass (Grams)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="e.g. 10"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
              />
            </div>
          )}
        </div>

        {isETF ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">NAV (per unit)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="NAV at purchase"
                  value={etfNavPerUnit}
                  onChange={(e) => setEtfNavPerUnit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 font-bold"
                />
                <p className="text-[10px] text-slate-600 mt-2 font-medium">
                  Used to estimate metal exposure (grams-equivalent).
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Price Paid (per unit)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Your buy price per unit"
                  value={etfPricePerUnit}
                  onChange={(e) => setEtfPricePerUnit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 font-bold"
                />
                <p className="text-[10px] text-slate-600 mt-2 font-medium">
                  Can differ from NAV due to charges / spread.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Consideration (auto)</label>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-200 font-mono">
                  {currencySymbol}
                  {(() => {
                    const u = parseFloat(etfUnits || '0');
                    const p = parseFloat(etfPricePerUnit || '0');
                    const v = u > 0 && p > 0 ? u * p : 0;
                    return v ? v.toFixed(2) : '0.00';
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Metal Equivalent (g)</label>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-400 font-mono">
                  {etfDerivedGrams != null ? etfDerivedGrams.toFixed(4) : '—'}
                  {etfDeriving && <span className="ml-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Deriving…</span>}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Consideration Paid</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
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
        )}

        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            {isETF
              ? 'ETF entries use units + NAV to estimate metal exposure (grams-equivalent) using historical spot on purchase date. Net returns may differ from actual ETF NAV moves.'
              : 'Calculations use live market rates. Net returns may be impacted by making charges or dealer premiums.'}
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
            className={`flex-[2] py-4 px-4 rounded-2xl ${metal === 'gold' ? 'gold-gradient' : 'bg-slate-500'} text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${etfDeriving ? 'opacity-60 cursor-wait' : ''}`}
            disabled={etfDeriving}
          >
            <Save className="w-4 h-4" />
            {mode === 'edit' ? 'Save Changes' : 'Archive Asset'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvestmentForm;
