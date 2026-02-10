
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Sparkles, TrendingUp, TrendingDown, Minus, Info, ChevronRight,
  AlertTriangle, ShieldCheck, Zap, Target, HelpCircle, ArrowRightCircle,
  Globe, Newspaper, ExternalLink, Activity, CheckCircle2, Circle, Search,
  Coins, RefreshCcw, Clock, Play, Database
} from 'lucide-react';
import { DailyPricePoint, SUPPORTED_CURRENCIES, MetalNarrative, MetalType } from '../types';
import { fetchMetalNarrative } from '../services/geminiService';
import { getHistoricalPriceData } from '../services/historicalPriceService';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
  BarChart, Bar, Cell
} from 'recharts';
import { COLORS } from '../constants';
import {
  getCachedDailySeries,
  saveDailySeriesCache,
  getCachedNarrative,
  saveNarrativeCache
} from '../services/aiCacheService';

interface AIInsightsProps {
  userId: string;
  currencyCode: string;
  selectedMetal: MetalType;
  setSelectedMetal: (metal: MetalType) => void;
}

type Signal = 'BUY' | 'HOLD' | 'SELL';
type Confidence = 'Low' | 'Medium' | 'High';

const AIInsights: React.FC<AIInsightsProps> = ({ userId, currencyCode, selectedMetal, setSelectedMetal }) => {
  const [showGuide, setShowGuide] = useState(false);
  const [narrative, setNarrative] = useState<MetalNarrative | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [dailySeries, setDailySeries] = useState<DailyPricePoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const currency = useMemo(() =>
    SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) || SUPPORTED_CURRENCIES[0]
    , [currencyCode]);

  // Load data from cache first, then from AI if needed
  const loadAnalysisData = useCallback(async (forceRefresh: boolean = false) => {
    setSeriesLoading(true);
    setNarrativeLoading(true);
    setLoadedFromCache(false);

    try {
      let seriesData: DailyPricePoint[] = [];
      let narrativeData: MetalNarrative | null = null;

      // Try to load from cache if not forcing refresh
      if (!forceRefresh) {
        const [cachedSeries, cachedNarrative] = await Promise.all([
          getCachedDailySeries(userId, selectedMetal, currencyCode),
          getCachedNarrative(userId, selectedMetal)
        ]);

        if (cachedSeries && cachedNarrative) {
          seriesData = cachedSeries.data;
          narrativeData = cachedNarrative.data;
          setLoadedFromCache(true);
        }
      }

      // If no cache or forcing refresh, fetch from API/Firestore
      if (seriesData.length === 0 || !narrativeData || forceRefresh) {
        // Use historical price service for reliable data
        const [freshSeries, freshNarrative] = await Promise.all([
          getHistoricalPriceData(selectedMetal, currencyCode, 250, forceRefresh),
          fetchMetalNarrative(selectedMetal)
        ]);

        seriesData = freshSeries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        narrativeData = freshNarrative;

        // Save to cache
        await Promise.all([
          saveDailySeriesCache(userId, selectedMetal, currencyCode, seriesData),
          saveNarrativeCache(userId, selectedMetal, narrativeData)
        ]);
        setLoadedFromCache(false);
      }

      setDailySeries(seriesData);
      setNarrative(narrativeData);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading analysis data:', error);
    } finally {
      setSeriesLoading(false);
      setNarrativeLoading(false);
    }
  }, [userId, selectedMetal, currencyCode]);

  // Auto-load if a shared daily cache exists (avoids "generate again and again")
  useEffect(() => {
    let cancelled = false;
    const tryLoadFromCacheOnly = async () => {
      try {
        const [cachedSeries, cachedNarrative] = await Promise.all([
          getCachedDailySeries(userId, selectedMetal, currencyCode),
          getCachedNarrative(userId, selectedMetal)
        ]);
        if (!cancelled && cachedSeries && cachedNarrative) {
          setDailySeries(cachedSeries.data);
          setNarrative(cachedNarrative.data);
          setDataLoaded(true);
          setLoadedFromCache(true);
        }
      } catch {
        // ignore
      }
    };
    tryLoadFromCacheOnly();
    return () => { cancelled = true; };
  }, [userId, selectedMetal, currencyCode]);

  // Regenerate - force refresh from AI
  const handleRegenerate = useCallback(() => {
    loadAnalysisData(true);
  }, [loadAnalysisData]);

  // Refresh narrative only
  const loadNarrativeOnly = useCallback(async (forceRefresh: boolean = false) => {
    setNarrativeLoading(true);

    try {
      let narrativeData: MetalNarrative | null = null;

      if (!forceRefresh) {
        const cached = await getCachedNarrative(userId, selectedMetal);
        if (cached) {
          narrativeData = cached.data;
          setLoadedFromCache(true);
        }
      }

      if (!narrativeData || forceRefresh) {
        narrativeData = await fetchMetalNarrative(selectedMetal);
        await saveNarrativeCache(userId, selectedMetal, narrativeData);
        setLoadedFromCache(false);
      }

      setNarrative(narrativeData);
    } catch (error) {
      console.error('Error loading narrative:', error);
    } finally {
      setNarrativeLoading(false);
    }
  }, [userId, selectedMetal]);

  const analysis = useMemo(() => {
    if (dailySeries.length < 100) return null;

    const prices = dailySeries.map(d => d.price);
    const lastPrice = prices[prices.length - 1];

    const getSMA = (data: number[], period: number) => {
      if (data.length < period) return null;
      const subset = data.slice(-period);
      return subset.reduce((a, b) => a + b, 0) / period;
    };

    const dma200 = getSMA(prices, 200);
    const dma50 = getSMA(prices, 50);
    const dma100 = getSMA(prices, 100);

    const mainDMA = dma200 || dma100;
    const dmaType = dma200 ? '200-DMA' : '100-DMA';
    const distancePct = mainDMA ? ((lastPrice - mainDMA) / mainDMA) * 100 : 0;

    let signal: Signal = 'HOLD';
    let statusLabel = '';
    let confidence: Confidence = 'Medium';
    let technical_score = 50;
    let tech_summary = "";

    let daysAbove = 0;
    let daysBelow = 0;
    let crossWithinLast5Days = false;

    for (let i = prices.length - 1; i >= 0; i--) {
      const subset = prices.slice(0, i + 1);
      const dmaAtI = getSMA(subset, dma200 ? 200 : 100);
      if (!dmaAtI) break;
      if (prices[i] > dmaAtI) {
        if (daysBelow > 0) break;
        daysAbove++;
      } else {
        if (daysAbove > 0) break;
        daysBelow++;
      }
    }

    for (let i = prices.length - 1; i >= Math.max(0, prices.length - 5); i--) {
      const subset = prices.slice(0, i + 1);
      const dmaAtI = getSMA(subset, dma200 ? 200 : 100);
      if (dmaAtI && prices[i] < dmaAtI) {
        crossWithinLast5Days = true;
        break;
      }
    }

    const metalName = selectedMetal.charAt(0).toUpperCase() + selectedMetal.slice(1);

    // Technical Analysis Narrative Construction
    if (lastPrice > mainDMA!) {
      if (crossWithinLast5Days && daysAbove >= 3) {
        signal = 'BUY';
        statusLabel = `BUY (Trend Reclaim)`;
        technical_score = 75;
        tech_summary = `${metalName} price recently crossed above the major trendline. This 'Trend Reclaim' is a bullish signal indicating that buyers have stepped in to defend long-term value.`;
      } else if (distancePct >= 0 && distancePct <= 3) {
        signal = 'BUY';
        statusLabel = `BUY at Current Levels`;
        technical_score = 90;
        tech_summary = `${metalName} is currently resting near its 200-day floor. This 'Safe Zone' is ideal for accumulation as the downside is limited by strong historical support.`;
      } else if (distancePct > 8) {
        signal = 'HOLD';
        statusLabel = `HOLD (Extended)`;
        technical_score = 60;
        tech_summary = `The asset is currently 'over-extended' from its average price. While the trend is up, entering here carries higher risk of a short-term correction.`;
      } else {
        signal = 'HOLD';
        statusLabel = `HOLD (Uptrend)`;
        technical_score = 70;
        tech_summary = `Steady bullish momentum is observed. The price is holding well above the 200-DMA, confirming a structural bull market is in progress.`;
      }
    } else {
      if (daysBelow >= 10) {
        signal = 'SELL';
        statusLabel = `SELL / REDUCE`;
        technical_score = 20;
        tech_summary = `Prolonged weakness below the 200-DMA confirms a bearish regime. Risks are skewed to the downside until a significant recovery occurs.`;
      } else {
        signal = 'HOLD';
        statusLabel = `HOLD (Watchlist)`;
        technical_score = 40;
        tech_summary = `Price is testing the support line from below. This is a critical junction; a failure to reclaim the 200-DMA soon could trigger a deeper sell-off.`;
      }
    }

    // SMA Cross Check
    if (dma50 && dma200) {
      if (dma50 > dma200) {
        tech_summary += " Additionally, the 'Golden Cross' (50-DMA > 200-DMA) suggests strong positive medium-term momentum.";
      } else {
        tech_summary += " The 'Death Cross' (50-DMA < 200-DMA) acts as a headwind, suggesting structural weakness remains.";
      }
    }

    const chartData = dailySeries.slice(-250).map((d) => {
      const idx = dailySeries.indexOf(d);
      const subset = dailySeries.slice(0, idx + 1).map(x => x.price);
      return {
        date: d.date,
        price: d.price,
        dma50: getSMA(subset, 50),
        dma200: getSMA(subset, 200)
      };
    });

    let narrative_weight = 0.15;
    let tech_weight = 0.85;
    let final_narrative_score = narrative?.sentiment_score || 50;

    if (technical_score < 40) {
      const delta = final_narrative_score - 50;
      final_narrative_score = 50 + Math.max(-5, Math.min(5, delta));
    }

    const health_score = (technical_score * tech_weight) + (final_narrative_score * narrative_weight);

    return {
      signal,
      statusLabel,
      confidence,
      lastPrice,
      mainDMA,
      dmaType,
      distancePct,
      chartData,
      technical_score,
      health_score,
      narrative_score: final_narrative_score,
      tech_summary
    };
  }, [dailySeries, narrative, selectedMetal]);

  // Initial state - show button to load data
  if (!dataLoaded && !seriesLoading) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 gold-gradient rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">AI Market Intelligence</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Click the button below to run AI-powered analysis on {selectedMetal === 'gold' ? 'Gold' : 'Silver'} market data.
            This includes DMA calculations, trend signals, and sentiment analysis from institutional reports.
          </p>
        </div>

        {/* Metal Selector */}
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 gap-1">
          <button
            onClick={() => setSelectedMetal('gold')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedMetal === 'gold' ? 'gold-gradient text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Sparkles className="w-4 h-4" /> Gold
          </button>
          <button
            onClick={() => setSelectedMetal('silver')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedMetal === 'silver' ? 'bg-slate-400 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Coins className="w-4 h-4" /> Silver
          </button>
        </div>

        <button
          onClick={() => loadAnalysisData(false)}
          className="flex items-center gap-3 px-8 py-4 gold-gradient rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Play className="w-5 h-5" />
          Run AI Analysis
        </button>

        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          <Database className="w-3 h-3 inline-block mr-1" />
          Data is cached daily and shared across users
        </p>
      </div>
    );
  }

  // Loading state
  if (seriesLoading || (narrativeLoading && !narrative)) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-amber-500/20 rounded-full animate-ping absolute inset-0"></div>
          <Sparkles className="w-20 h-20 text-amber-500 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Synchronizing Markets</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Running DMA rule-set & narrative sentiment engine...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-amber-500" />
        <div className="text-center">
          <h3 className="text-xl font-black text-white mb-2">Insufficient Data</h3>
          <p className="text-slate-500 text-sm max-w-md">
            Not enough price data points to perform technical analysis. At least 100 days of data is required.
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 rounded-xl text-white font-bold text-xs uppercase tracking-widest hover:bg-amber-400 transition-all"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry Analysis
        </button>
      </div>
    );
  }

  const healthColor = analysis.health_score > 70 ? 'text-emerald-400' : analysis.health_score < 40 ? 'text-rose-400' : 'text-amber-400';
  const sentimentColor = narrative?.expert_outlook === 'Bullish' ? 'text-emerald-400' : narrative?.expert_outlook === 'Bearish' ? 'text-rose-400' : 'text-amber-400';
  const metalColor = selectedMetal === 'gold' ? COLORS.GOLD : COLORS.SILVER;
  const metalNameLabel = selectedMetal === 'gold' ? 'Gold' : 'Silver';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header with Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          {/* Metal Selector */}
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setSelectedMetal('gold'); setDataLoaded(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedMetal === 'gold' ? 'gold-gradient text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Sparkles className="w-3 h-3" /> Gold
            </button>
            <button
              onClick={() => { setSelectedMetal('silver'); setDataLoaded(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedMetal === 'silver' ? 'bg-slate-400 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Coins className="w-3 h-3" /> Silver
            </button>
          </div>

          {/* Cache indicator */}
          {loadedFromCache && (
            <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <Database className="w-3 h-3" />
              Loaded from Cache
            </div>
          )}
        </div>

        {/* Regenerate Button */}
        <button
          onClick={handleRegenerate}
          disabled={seriesLoading || narrativeLoading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 font-bold text-[10px] uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-50"
        >
          <RefreshCcw className={`w-3 h-3 ${seriesLoading || narrativeLoading ? 'animate-spin' : ''}`} />
          Regenerate Analysis
        </button>
      </div>

      {/* 1. Market Health Score Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 border border-slate-700/30 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-full h-1 ${selectedMetal === 'gold' ? 'gold-gradient' : 'bg-slate-400'}`}></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">{metalNameLabel} Health Score</p>

          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent"
                strokeDasharray={440} strokeDashoffset={440 - (440 * analysis.health_score) / 100}
                className={`transition-all duration-1000 ease-out ${healthColor}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-black tracking-tighter ${healthColor}`}>{Math.round(analysis.health_score)}</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Aggregate</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <h4 className={`text-lg font-black uppercase tracking-widest ${healthColor}`}>
              {analysis.health_score > 75 ? 'Optimal' : analysis.health_score > 55 ? 'Neutral' : 'Critical'}
            </h4>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Pulse</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-8 sm:p-10 border-l-8 border-l-amber-500 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-amber-500" /> Technical Verdict: <span className={analysis.signal === 'BUY' ? 'text-emerald-400' : analysis.signal === 'SELL' ? 'text-rose-400' : 'text-amber-400'}>{analysis.signal}</span>
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 ml-11">{analysis.statusLabel}</p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                <div className="px-6 py-2 border-r border-slate-800 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Tech Weight</p>
                  <p className="text-xs font-black text-white">85%</p>
                </div>
                <div className="px-6 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Narrative Weight</p>
                  <p className="text-xs font-black text-amber-500">15%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Data Pulled: {narrative ? new Date(narrative.last_updated).toLocaleTimeString() : '...'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Trend (DMA)</span>
                <span className="text-xs font-bold text-white">{analysis.technical_score}/100</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-1000" style={{ width: `${analysis.technical_score}%` }}></div>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Narrative Sentiment</span>
                <span className="text-xs font-bold text-white">{Math.round(analysis.narrative_score)}/100</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${analysis.narrative_score}%` }}></div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50 flex items-start gap-4">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium italic">
                The {metalNameLabel} Health Score combines algorithmic technical rules (DMA, Crosses) with deep AI narrative sentiment parsing of institutional reports and geopolitical news.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metal Insights & Expert Outlook Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Expert Outlook Card */}
        <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 border-t-4 border-t-amber-500 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Newspaper className="w-6 h-6 text-amber-500" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Expert Outlook: {metalNameLabel}</h3>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${sentimentColor} bg-slate-900`}>
              {narrative?.expert_outlook}
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              {narrative?.summary}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Institutional Pulse</p>
                <button
                  onClick={() => loadNarrativeOnly(true)}
                  disabled={narrativeLoading}
                  className="flex items-center gap-2 text-[9px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors"
                >
                  <RefreshCcw className={`w-3 h-3 ${narrativeLoading ? 'animate-spin' : ''}`} />
                  Update Intelligence
                </button>
              </div>
              {narrative?.reports.slice(0, 3).map((report, i) => (
                <div key={i} className="flex items-start gap-4 p-3 bg-slate-800/20 rounded-xl border border-slate-700/30">
                  <Activity className={`w-4 h-4 shrink-0 mt-0.5 ${report.tone === 'Bullish' ? 'text-emerald-400' : report.tone === 'Bearish' ? 'text-rose-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-white">{report.institution}</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">{report.date}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{report.summary_text}</p>
                  </div>
                </div>
              ))}
              {(!narrative?.reports || narrative?.reports.length === 0) && (
                <div className="text-center py-6 text-slate-500 text-xs italic">No recent institutional reports indexed.</div>
              )}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              <Globe className="w-3 h-3" />
              Sources Found: {narrative?.sources.length}
            </div>
            <p className="text-[9px] text-slate-600 font-bold uppercase">Last Grounded: {narrative ? new Date(narrative.last_updated).toLocaleTimeString() : '...'}</p>
          </div>
        </div>

        {/* Geopolitical Pulse Card */}
        <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 border-t-4 border-t-rose-500 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-rose-500" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Geopolitical Pulse</h3>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-slate-900 ${narrative?.geopolitical_impact === 'Positive' ? 'text-emerald-400 border-emerald-500/30' : narrative?.geopolitical_impact === 'Negative' ? 'text-rose-400 border-rose-500/30' : 'text-slate-400 border-slate-400'}`}>
              Impact: {narrative?.geopolitical_impact}
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <div className="p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl">
              <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4">Risk Factors & Drivers</h4>
              <ul className="space-y-4">
                {narrative?.geo_bullets.map((bullet, i) => (
                  <li key={i} className="flex gap-4 items-start group">
                    <div className="w-2 h-2 rounded-full bg-rose-500/40 mt-1.5 group-hover:bg-rose-500 transition-colors shrink-0"></div>
                    <span className="text-xs font-bold text-slate-300 leading-normal">{bullet}</span>
                  </li>
                ))}
                {(!narrative?.geo_bullets || narrative?.geo_bullets.length === 0) && (
                  <li className="text-xs text-slate-500 italic">No critical geopolitical triggers identified.</li>
                )}
              </ul>
            </div>
            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Score Adjustment</p>
              <div className={`text-2xl font-black ${(narrative?.geo_modifier ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(narrative?.geo_modifier ?? 0) >= 0 ? '+' : ''}{narrative?.geo_modifier ?? 0} Points Added
              </div>
              <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">Based on global risk intensity</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-black uppercase tracking-widest italic">
              <AlertTriangle className="w-4 h-4 text-amber-500/30" />
              Expert Outlooks are dynamic and updated daily.
            </div>
          </div>
        </div>
      </div>

      {/* 3. DMA Visualizer Chart with Live Analysis */}
      <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 shadow-2xl overflow-hidden relative border border-slate-700/20">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 relative z-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-amber-500" /> Technical Momentum Visualizer
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Tracking historical {analysis.dmaType} overlays and price volatility.</p>
            </div>

            {/* Metal Selector Toggle */}
            <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-inner mt-2 sm:mt-0">
              <button
                onClick={() => { setSelectedMetal('gold'); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMetal === 'gold' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Sparkles className="w-3 h-3" />
                Gold
              </button>
              <button
                onClick={() => { setSelectedMetal('silver'); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMetal === 'silver' ? 'bg-slate-400 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Coins className="w-3 h-3" />
                Silver
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white shadow-sm shadow-white/50"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">200-DMA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">50-DMA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${selectedMetal === 'gold' ? 'gold-gradient' : 'bg-slate-400'}`}></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spot Price</span>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-2 ${showGuide ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-500'}`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Chart Intelligence Block */}
        <div className="mb-10 p-7 bg-slate-900/60 rounded-3xl border border-slate-800 backdrop-blur-sm relative z-20 flex flex-col md:flex-row items-start md:items-center gap-6 animate-in fade-in duration-500">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
            <Search className="w-6 h-6 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Live Chart Analysis: {selectedMetal.toUpperCase()}</h4>
            <p className="text-xs text-slate-300 leading-relaxed font-bold">
              {analysis.tech_summary}
            </p>
          </div>
        </div>

        {showGuide && (
          <div className="mb-10 p-8 bg-slate-900/80 backdrop-blur border border-amber-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300 relative z-20">
            <h4 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Reading the Chart Like a Pro
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Trend Logic
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  When the <span className={`${selectedMetal === 'gold' ? 'text-amber-400' : 'text-slate-200'} font-bold`}>{selectedMetal.toUpperCase()} Line</span> is above the <span className="text-white font-bold">White Line</span> (200-DMA), it is in a structural bull market.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <ArrowRightCircle className="w-4 h-4 text-amber-500" /> Support Zone
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  The <span className="text-white font-bold italic">White Line</span> acts as a technical floor. Buying within 0-3% of this line reduces downside risk.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Zap className="w-4 h-4 text-emerald-500" /> Golden Cross
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  When the <span className="text-slate-400 font-bold">Gray Line</span> (50-DMA) crosses Above the 200-DMA, short-term momentum is bullish.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Death Cross
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  When the <span className="text-slate-400 font-bold">Gray Line</span> crosses Below the 200-DMA, it's a major warning of structural weakness.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="h-[450px] min-w-0 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analysis.chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metalColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={metalColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={15}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dx={-15}
                tickFormatter={(v) => `${currency.symbol}${v.toLocaleString()}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
              <Area type="monotone" dataKey="price" name={`${selectedMetal.toUpperCase()} Price`} stroke={metalColor} strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" animationDuration={2500} />
              <Line type="monotone" dataKey="dma50" name="50-DMA" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="6 6" />
              <Line type="monotone" dataKey="dma200" name="200-DMA" stroke="#ffffff" strokeWidth={2} dot={false} strokeOpacity={0.9} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intelligence Grounding Sources */}
      {narrative && narrative.sources.length > 0 && (
        <div className="glass-card rounded-3xl p-8 border border-slate-700/30 overflow-hidden shadow-2xl">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <Newspaper className="w-4 h-4 text-amber-500" /> Intelligence Grounding: {metalNameLabel}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {narrative.sources.map((source, i) => (
              <a
                key={i}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 truncate group-hover:text-slate-200 transition-colors">{source.title}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-amber-500 transition-colors" />
              </a>
            ))}
          </div>
          <div className="mt-8 pt-4 border-t border-slate-800 text-[9px] text-slate-600 font-bold uppercase text-center">
            Educational guidance only; not financial advice. No guaranteed returns.
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
