import React, { useState, useMemo, useCallback } from 'react';
import {
  Calculator, ShieldAlert, TrendingUp, TrendingDown,
  Minus, CheckCircle2, AlertTriangle, ChevronDown,
  ChevronUp, Zap, Target, ArrowRightCircle, RefreshCcw, Sparkles,
  Play, Database
} from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import { AdvisorMode, AdvisorMetrics, AdvisorResponse, AdvisorSignal, DailyPricePoint } from '../types';
import { getLatestAdvisorData, saveAdvisorData } from '../services/firestoreService';
import { getHistoricalPriceData } from '../services/historicalPriceService';

interface GoldAdvisorProps {
  userId: string;
  currencyCode: string;
}

const GoldAdvisor: React.FC<GoldAdvisorProps> = ({ userId, currencyCode }) => {
  const [price, setPrice] = useState<number>(0);
  const [dma50, setDma50] = useState<number>(0);
  const [dma200, setDma200] = useState<number>(0);
  const [mode, setMode] = useState<AdvisorMode>('LUMPSUM');
  const [allocation, setAllocation] = useState<number | ''>(100000);
  const [loading, setLoading] = useState(false);
  const [showWhy, setShowWhy] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Constants
  const SIP_CAP_PCT = 10;

  // Calculate Simple Moving Average from price data
  const calculateSMA = (data: DailyPricePoint[], period: number): number => {
    if (data.length < period) return 0;
    const subset = data.slice(-period);
    return subset.reduce((sum, d) => sum + d.price, 0) / period;
  };

  // Load data from historical price service (Metals.dev API)
  const loadAdvisorData = useCallback(async (forceRefresh: boolean = false) => {
    setLoading(true);

    try {
      // Try DB cache first if not forced
      if (!forceRefresh) {
        const cached = await getLatestAdvisorData(currencyCode);
        if (cached) {
          setPrice(cached.price);
          setDma50(cached.dma50);
          setDma200(cached.dma200);
          setLastUpdated(cached.lastUpdated);
          setDataLoaded(true);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh historical data from Metals.dev API
      console.log('Fetching historical data for advisor from Metals.dev API...');
      const historicalData = await getHistoricalPriceData('gold', currencyCode, 250, forceRefresh);

      if (historicalData.length < 50) {
        console.error('Insufficient historical data for DMA calculations');
        setLoading(false);
        return;
      }

      // Sort data by date (oldest to newest)
      const sortedData = [...historicalData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Get latest price and calculate DMAs
      const latestPrice = sortedData[sortedData.length - 1].price;
      const calculatedDma50 = calculateSMA(sortedData, 50);
      const calculatedDma200 = calculateSMA(sortedData, 200) || calculateSMA(sortedData, sortedData.length); // Fallback if <200 days

      const newCache = {
        price: parseFloat(latestPrice.toFixed(2)),
        dma50: parseFloat(calculatedDma50.toFixed(2)),
        dma200: parseFloat(calculatedDma200.toFixed(2)),
        currency: currencyCode,
        lastUpdated: new Date().toISOString()
      };

      console.log('Advisor data calculated:', newCache);

      setPrice(newCache.price);
      setDma50(newCache.dma50);
      setDma200(newCache.dma200);
      setLastUpdated(newCache.lastUpdated);
      setDataLoaded(true);

      // Save to DB for caching
      await saveAdvisorData(newCache);

    } catch (error) {
      console.error('Error loading advisor data:', error);
    } finally {
      setLoading(false);
    }
  }, [currencyCode]);

  // Regenerate - force refresh from API -> DB
  const handleRegenerate = useCallback(() => {
    loadAdvisorData(true);
  }, [loadAdvisorData]);

  const computeMetrics = (P: number, D50: number, D200: number): AdvisorMetrics => {
    if (!P || !D50 || !D200) return {
      delta50: 0, delta200: 0, goldenCross: false, deathCross: false, blockLumpsum: false
    };
    return {
      delta50: ((P - D50) / D50) * 100,
      delta200: ((P - D200) / D200) * 100,
      goldenCross: D50 >= D200,
      deathCross: D50 < D200,
      blockLumpsum: ((P - D50) / D50) * 100 > 4
    };
  };

  const evaluateRules = (metrics: AdvisorMetrics, P: number, D200: number, mode: AdvisorMode): Partial<AdvisorResponse> => {
    if (loading || P === 0) return { signal: 'HOLD', investPctNow: 0, message: "Awaiting market data...", nextAction: "Syncing..." };

    // R1: SELL / RISK OFF
    if (P < D200 && metrics.deathCross) {
      return {
        signal: 'SELL_RISK_OFF',
        investPctNow: 0,
        targetExposurePct: 30,
        lumpSumAllowed: false,
        sipAllowed: false,
        message: "Trend breakdown: price below 200-DMA and 50-DMA below 200-DMA. Reduce risk exposure.",
        nextAction: "Do not invest now; reduce exposure toward 30%."
      };
    }

    // R2: STRONG BUY
    if (P <= D200 || metrics.delta200 <= 2) {
      return {
        signal: 'STRONG_BUY',
        investPctNow: 100,
        lumpSumAllowed: true,
        sipAllowed: true,
        message: "Strong accumulation zone near/below 200-DMA. Best risk-adjusted entry.",
        nextAction: "Invest full planned allocation now."
      };
    }

    // R3: BUY
    if (P > D200 && metrics.goldenCross && metrics.delta50 <= 2) {
      return {
        signal: 'BUY',
        investPctNow: 80,
        lumpSumAllowed: true,
        sipAllowed: true,
        message: "Bull trend intact and price is close to 50-DMA. Good entry with high conviction.",
        nextAction: "Invest 80% now; keep 20% for dips."
      };
    }

    // R4: ACCUMULATE
    if (metrics.goldenCross && metrics.delta50 > 2 && metrics.delta50 <= 6) {
      return {
        signal: 'ACCUMULATE',
        investPctNow: 40,
        lumpSumAllowed: !metrics.blockLumpsum,
        sipAllowed: true,
        message: "Uptrend intact but mildly extended. Use staggered buying.",
        nextAction: "Invest 40% now; reserve 60% for pullbacks."
      };
    }

    // R5: HOLD
    if (metrics.goldenCross && metrics.delta50 > 6 && metrics.delta50 <= 10) {
      return {
        signal: 'HOLD',
        investPctNow: mode === 'SIP' ? Math.min(10, SIP_CAP_PCT) : 0,
        lumpSumAllowed: false,
        sipAllowed: true,
        message: "Overextended above 50-DMA. Prefer waiting or SIP only.",
        nextAction: "Do not lump-sum; SIP up to 10% only."
      };
    }

    // R6: WAIT / TRIM
    if (metrics.delta50 > 10) {
      return {
        signal: 'WAIT_TRIM',
        investPctNow: mode === 'SIP' ? Math.min(5, SIP_CAP_PCT) : 0,
        lumpSumAllowed: false,
        sipAllowed: true,
        trimPctOptional: "10-20",
        message: "Overbought zone. Avoid lump-sum. Consider trimming profits if overweight.",
        nextAction: "Avoid buying; SIP max 5% if needed; optionally trim 10–20% if overweight."
      };
    }

    // R7: Fallback
    return {
      signal: 'HOLD',
      investPctNow: mode === 'SIP' ? 5 : 0,
      lumpSumAllowed: false,
      sipAllowed: true,
      message: "No strong signal. Stay cautious.",
      nextAction: "SIP small (5%) or wait."
    };
  };

  const response = useMemo((): AdvisorResponse => {
    const sanitizedAllocation = typeof allocation === 'number' && Number.isFinite(allocation) && allocation > 0
      ? allocation
      : null;
    const metrics = computeMetrics(price, dma50, dma200);
    const ruleOutput = evaluateRules(metrics, price, dma200, mode);

    return {
      ...ruleOutput,
      allocationNowAmount: sanitizedAllocation ? (sanitizedAllocation * (ruleOutput.investPctNow || 0)) / 100 : null,
      metrics,
    } as AdvisorResponse;
  }, [price, dma50, dma200, mode, allocation, loading]);

  const getSignalColor = (sig: AdvisorSignal) => {
    switch (sig) {
      case 'STRONG_BUY': return 'bg-emerald-500 text-white';
      case 'BUY': return 'bg-emerald-400 text-slate-900';
      case 'ACCUMULATE': return 'bg-amber-400 text-slate-900';
      case 'HOLD': return 'bg-slate-500 text-white';
      case 'WAIT_TRIM': return 'bg-rose-400 text-white';
      case 'SELL_RISK_OFF': return 'bg-rose-600 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  // Initial state - show button to load data
  if (!dataLoaded && !loading) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 gold-gradient rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
            <Calculator className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Gold Advisor Engine</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Click the button below to run the DMA-based investment advisor.
            This fetches live gold prices and moving averages from the central database.
          </p>
        </div>

        <button
          onClick={() => loadAdvisorData(false)}
          className="flex items-center gap-3 px-8 py-4 gold-gradient rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Play className="w-5 h-5" />
          Run Advisor Analysis
        </button>

        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          <Database className="w-3 h-3 inline-block mr-1" />
          Data is cached daily and shared across users
        </p>
      </div>
    );
  }

  // Loading state
  if (loading && !dataLoaded) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-amber-500/20 rounded-full animate-ping absolute inset-0"></div>
          <Calculator className="w-20 h-20 text-amber-500 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Fetching Market Context</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Syncing gold prices and history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <Calculator className="w-8 h-8 text-amber-500" />
            Gold Advisor
            <span className="text-slate-500 text-xl font-medium tracking-normal">(DMA Engine)</span>
            <InfoTooltip content="Rule-driven allocation assistant using live spot price plus 50/200-DMA trend checks for entry timing." />
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-widest">Rule-Based Investment Guidance</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <Database className="w-3 h-3" />
            Live DB
          </div>

          {lastUpdated && (
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}

          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-amber-500 shadow-lg border border-slate-700/50 active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Force Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Inputs */}
        <div className="glass-card rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-700/30 flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>

          <div className="mb-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Live Market Context
              <InfoTooltip content="Current spot and moving-average levels used as direct inputs for all recommendation rules." />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Spot Price</p>
                <p className="text-sm sm:text-lg font-black text-amber-500">{loading ? '...' : price.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">DMA 50</p>
                <p className="text-sm sm:text-lg font-black text-slate-200">{loading ? '...' : dma50.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">DMA 200</p>
                <p className="text-sm sm:text-lg font-black text-slate-200">{loading ? '...' : dma200.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            Strategy Configuration
            <InfoTooltip content="Choose lump-sum vs SIP behavior and planned allocation; output changes instantly with these controls." />
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Investment Strategy</label>
              <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
                <button
                  onClick={() => setMode('LUMPSUM')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'LUMPSUM' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Lump-sum Entry
                </button>
                <button
                  onClick={() => setMode('SIP')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'SIP' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Systematic (SIP)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Planned Allocation (INR)</label>
              <input
                type="number"
                placeholder="e.g. 100,000"
                value={allocation}
                min="0"
                step="1"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setAllocation('');
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  setAllocation(parsed);
                }}
                className="w-full h-16 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 text-xl font-black text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          <div className="mt-2 p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
              Strategy Logic: {mode === 'LUMPSUM' ? "Aggressive capture based on technical pullbacks." : "Conservative staggered accumulation capped at 10% monthly."}
            </p>
          </div>
        </div>

        {/* Right: Output */}
        <div className="glass-card rounded-[2.5rem] p-8 border border-slate-700/30 flex flex-col gap-6 relative overflow-hidden bg-slate-900/40">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <Sparkles className="w-12 h-12 text-amber-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Running Advisor Logic Engine...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  Verdict Engine Signal
                  <InfoTooltip content="Final signal selected from rule hierarchy: Strong Buy, Buy, Accumulate, Hold, Wait/Trim, or Sell Risk-Off." align="right" />
                </h3>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-lg ${getSignalColor(response.signal)}`}>
                  {response.signal.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <div className="p-4 sm:p-6 bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-slate-800 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Invest % Now</p>
                  <p className="text-2xl sm:text-4xl font-black text-white">{response.investPctNow}%</p>
                </div>
                <div className="p-4 sm:p-6 bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-slate-800 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Allocation (INR)</p>
                  <p className="text-2xl sm:text-4xl font-black text-amber-500">{response.allocationNowAmount ? Math.round(response.allocationNowAmount).toLocaleString() : '---'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/30">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${response.lumpSumAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                    {response.lumpSumAllowed ? <CheckCircle2 className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase">Lump-sum Strategy</p>
                    <p className="text-xs font-bold text-white uppercase">{response.lumpSumAllowed ? 'Available' : 'Restricted'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/30">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${response.sipAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                    {response.sipAllowed ? <CheckCircle2 className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase">SIP / Staggered Entry</p>
                    <p className="text-xs font-bold text-white uppercase">{response.sipAllowed ? 'Approved' : 'Restricted'}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl mt-auto">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ArrowRightCircle className="w-4 h-4" />
                  Recommended Execution
                  <InfoTooltip content="Action sentence translates the signal into a practical allocation move for the selected strategy mode." align="right" />
                </h4>
                <p className="text-xs font-bold text-white leading-relaxed">{response.nextAction}</p>
                <p className="text-[10px] text-slate-500 mt-2 italic">"{response.message}"</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Why this? (Collapsible Metrics) */}
      {!loading && price > 0 && (
        <div className="glass-card rounded-3xl border border-slate-700/30 overflow-hidden">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                Why this recommendation?
                <InfoTooltip content="Shows raw factors behind the verdict: distances from 50/200-DMA, cross regime, and entry-risk gate." />
              </span>
            </div>
            {showWhy ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showWhy && (
            <div className="px-4 sm:px-8 pb-4 sm:pb-8 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 animate-in slide-in-from-top-2 duration-300">
              <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Distance from 50-DMA</p>
                <p className={`text-lg font-black ${Math.abs(response.metrics.delta50) > 8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {response.metrics.delta50.toFixed(2)}%
                </p>
                <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">
                  {response.metrics.delta50 > 0 ? 'Market Expansion' : 'Market Pullback'}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Distance from 200-DMA</p>
                <p className="text-base sm:text-lg font-black text-amber-500">
                  {response.metrics.delta200.toFixed(2)}%
                </p>
                <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">Long-term Health Index</p>
              </div>
              <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Systemic Trend</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${response.metrics.goldenCross ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <p className="text-base sm:text-lg font-black text-white">
                    {response.metrics.goldenCross ? 'Bullish Regime' : 'Bearish Regime'}
                  </p>
                </div>
                <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">DMA Cross Status</p>
              </div>
              <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Entry Risk Level</p>
                <p className={`text-lg font-black ${response.metrics.blockLumpsum ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {response.metrics.blockLumpsum ? 'High (Wait)' : 'Moderate (Accumulate)'}
                </p>
                <p className="text-[8px] text-slate-600 font-bold uppercase mt-1">Volatility Check</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center pt-8 border-t border-slate-800/50">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
          <AlertTriangle className="w-3 h-3" /> Educational guidance only. Not financial advice.
        </p>
      </div>
    </div>
  );
};

export default GoldAdvisor;
