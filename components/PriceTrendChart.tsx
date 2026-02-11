
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, RefreshCcw, BarChart3, Download, CheckCircle } from 'lucide-react';
import { getPriceHistory, PriceHistoryPoint } from '../services/firestoreService';
import { backfillPriceHistory } from '../services/historicalPriceService';
import { Purity } from '../types';
import { PURITY_MULTIPLIERS } from '../constants';
import InfoTooltip from './InfoTooltip';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface PriceTrendChartProps {
    currency: string;
    currencySymbol: string;
}

type TimeRange = '7D' | '30D' | '90D' | '6M' | '1Y';

const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ currency, currencySymbol }) => {
    const [goldHistory, setGoldHistory] = useState<PriceHistoryPoint[]>([]);
    const [silverHistory, setSilverHistory] = useState<PriceHistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('30D');
    const [selectedMetal, setSelectedMetal] = useState<'both' | 'gold' | 'silver'>('gold');
    const [goldPurityView, setGoldPurityView] = useState<'24K' | '22K' | 'both'>('both');
    const [backfilling, setBackfilling] = useState(false);
    const [backfillResult, setBackfillResult] = useState<{ success: boolean; goldCount: number; silverCount: number } | null>(null);

    const timeRangeDays: Record<TimeRange, number> = {
        '7D': 7,
        '30D': 30,
        '90D': 90,
        '6M': 180,
        '1Y': 365
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const days = timeRangeDays[timeRange];
            const [gold, silver] = await Promise.all([
                getPriceHistory('gold', currency, days),
                getPriceHistory('silver', currency, days)
            ]);
            setGoldHistory(gold);
            setSilverHistory(silver);
        } catch (error) {
            console.error('Error loading price history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [currency, timeRange]);

    // Handle backfill of historical data
    const handleBackfill = async () => {
        setBackfilling(true);
        setBackfillResult(null);
        try {
            const result = await backfillPriceHistory(currency, timeRangeDays[timeRange]);
            setBackfillResult(result);
            if (result.success) {
                // Reload history after backfill
                await loadHistory();
            }
        } catch (error) {
            console.error('Backfill error:', error);
            setBackfillResult({ success: false, goldCount: 0, silverCount: 0 });
        } finally {
            setBackfilling(false);
        }
    };

    // Merge gold and silver data by date for the chart
    interface ChartDataPoint {
        date: string;
        displayDate: string;
        gold24?: number;
        gold22?: number;
        silver?: number;
    }

    const formatDisplayDate = (timestamp: string) => {
        const d = new Date(timestamp);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const chartData = React.useMemo(() => {
        const dataMap = new Map<string, ChartDataPoint>();

        goldHistory.forEach(point => {
            const dateKey = point.timestamp.substring(0, 10); // YYYY-MM-DD
            const existing: ChartDataPoint = dataMap.get(dateKey) || { date: point.timestamp, displayDate: formatDisplayDate(point.timestamp), gold24: undefined, gold22: undefined, silver: undefined };
            existing.gold24 = point.pricePerGram;
            existing.gold22 = point.pricePerGram * PURITY_MULTIPLIERS[Purity.K22];
            dataMap.set(dateKey, existing);
        });

        silverHistory.forEach(point => {
            const dateKey = point.timestamp.substring(0, 10); // YYYY-MM-DD
            const existing: ChartDataPoint = dataMap.get(dateKey) || { date: point.timestamp, displayDate: formatDisplayDate(point.timestamp), gold24: undefined, gold22: undefined, silver: undefined };
            existing.silver = point.pricePerGram;
            dataMap.set(dateKey, existing);
        });

        return Array.from(dataMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [goldHistory, silverHistory]);

    // Calculate trend
    const calculateTrend = (history: PriceHistoryPoint[]) => {
        if (history.length < 2) return { change: 0, percentage: 0, isUp: true };
        const first = history[0].pricePerGram;
        const last = history[history.length - 1].pricePerGram;
        const change = last - first;
        const percentage = first > 0 ? (change / first) * 100 : 0;
        return { change, percentage, isUp: change >= 0 };
    };

    const goldTrend24 = calculateTrend(goldHistory);
    const goldTrend22 = {
        change: goldTrend24.change * PURITY_MULTIPLIERS[Purity.K22],
        percentage: goldTrend24.percentage,
        isUp: goldTrend24.isUp
    };
    const silverTrend = calculateTrend(silverHistory);

    const hasData = chartData.length > 0;
    const expectedPoints = timeRangeDays[timeRange];
    const needsMoreData = chartData.length < Math.floor(expectedPoints * 0.85);

    return (
        <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                        <BarChart3 className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                            Price Trend History
                            <InfoTooltip content="Historical per-gram movement view for gold and silver based on your selected range and metal filters." />
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">From your tracked data</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Time Range Selector */}
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                        {(['7D', '30D', '90D', '6M', '1Y'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-2 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === range
                                    ? 'bg-amber-500 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={loadHistory}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-all"
                        title="Refresh"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Backfill Button - show if current range is underpopulated */}
                    {!loading && needsMoreData && (
                        <button
                            onClick={handleBackfill}
                            disabled={backfilling}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            title={`Fetch ${timeRangeDays[timeRange]} days of historical data`}
                        >
                            {backfilling ? (
                                <RefreshCcw className="w-3 h-3 animate-spin" />
                            ) : backfillResult?.success ? (
                                <CheckCircle className="w-3 h-3" />
                            ) : (
                                <Download className="w-3 h-3" />
                            )}
                            {backfilling ? 'Loading...' : 'Backfill Data'}
                        </button>
                    )}
                </div>
            </div>

            {/* Metal Toggle */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setSelectedMetal('gold')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedMetal === 'gold'
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:text-slate-300'
                        }`}
                >
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    Gold
                </button>
                <button
                    onClick={() => setSelectedMetal('silver')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedMetal === 'silver'
                        ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:text-slate-300'
                        }`}
                >
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    Silver
                </button>
                <button
                    onClick={() => setSelectedMetal('both')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedMetal === 'both'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:text-slate-300'
                        }`}
                >
                    Both
                </button>
            </div>

            {/* Gold Purity Toggle (to reduce clutter) */}
            {(selectedMetal === 'gold' || selectedMetal === 'both') && (
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        Gold series
                        <InfoTooltip content="Switch between 24K, 22K, or both gold lines to reduce chart clutter and compare purity movement." />
                    </div>
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                        {(['24K', '22K', 'both'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setGoldPurityView(v)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${goldPurityView === v
                                    ? 'bg-amber-500 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                title={v === 'both' ? 'Show 24K + 22K' : `Show ${v} only`}
                            >
                                {v === 'both' ? 'Both' : v}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Trend Summary Cards */}
            {hasData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                    {(selectedMetal === 'gold' || selectedMetal === 'both') && goldHistory.length > 0 && (
                        <>
                            {(goldPurityView === '24K' || goldPurityView === 'both') && (
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gold 24K Trend</span>
                                        {goldTrend24.isUp ? (
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <TrendingDown className="w-4 h-4 text-rose-500" />
                                        )}
                                    </div>
                                    <p className={`text-lg font-bold ${goldTrend24.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {goldTrend24.isUp ? '+' : ''}{goldTrend24.percentage.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {goldTrend24.isUp ? '+' : ''}{currencySymbol}{goldTrend24.change.toFixed(2)}/g
                                    </p>
                                </div>
                            )}

                            {(goldPurityView === '22K' || goldPurityView === 'both') && (
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gold 22K Trend</span>
                                        {goldTrend22.isUp ? (
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <TrendingDown className="w-4 h-4 text-rose-500" />
                                        )}
                                    </div>
                                    <p className={`text-lg font-bold ${goldTrend22.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {goldTrend22.isUp ? '+' : ''}{goldTrend22.percentage.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {goldTrend22.isUp ? '+' : ''}{currencySymbol}{goldTrend22.change.toFixed(2)}/g
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                    {(selectedMetal === 'silver' || selectedMetal === 'both') && silverHistory.length > 0 && (
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Silver Trend</span>
                                {silverTrend.isUp ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-rose-500" />
                                )}
                            </div>
                            <p className={`text-lg font-bold ${silverTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {silverTrend.isUp ? '+' : ''}{silverTrend.percentage.toFixed(2)}%
                            </p>
                            <p className="text-xs text-slate-400">
                                {silverTrend.isUp ? '+' : ''}{currencySymbol}{silverTrend.change.toFixed(2)}/g
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Chart */}
            <div className="h-[240px] sm:h-[300px] overflow-x-auto custom-scrollbar">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <RefreshCcw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Loading price history...</p>
                        </div>
                    </div>
                ) : !hasData ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center px-8">
                            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold mb-2">No Price History Yet</p>
                            <p className="text-slate-600 text-sm mb-6">
                                Click the button below to fetch {timeRange} of historical price data from Metals.dev API.
                            </p>
                            <button
                                onClick={handleBackfill}
                                disabled={backfilling}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-white font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 mx-auto"
                            >
                                {backfilling ? (
                                    <RefreshCcw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {backfilling ? 'Fetching Historical Data...' : `Backfill ${timeRange}`}
                            </button>
                            {backfillResult && (
                                <p className={`text-xs mt-4 ${backfillResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {backfillResult.success
                                        ? `✓ Added ${backfillResult.goldCount} gold + ${backfillResult.silverCount} silver entries`
                                        : '✗ Failed to backfill data. Check console for errors.'}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="min-w-[600px] h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gold24Gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gold22Gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="silverGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#475569"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#475569"
                                    fontSize={9}
                                    tickLine={false}
                                    axisLine={false}
                                    width={55}
                                    tickFormatter={(v) => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '12px',
                                        padding: '12px'
                                    }}
                                    labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                    formatter={(value: number, name: string) => {
                                        const label =
                                            name === 'gold24' ? 'Gold 24K'
                                                : name === 'gold22' ? 'Gold 22K'
                                                    : 'Silver';
                                        return [`${currencySymbol}${value.toFixed(2)}/g`, label];
                                    }}
                                />
                                {(selectedMetal === 'gold' || selectedMetal === 'both') && (
                                    <>
                                        {(goldPurityView === '24K' || goldPurityView === 'both') && (
                                            <Area
                                                type="monotone"
                                                dataKey="gold24"
                                                stroke="#f59e0b"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#gold24Gradient)"
                                                name="gold24"
                                            />
                                        )}
                                        {(goldPurityView === '22K' || goldPurityView === 'both') && (
                                            <Area
                                                type="monotone"
                                                dataKey="gold22"
                                                stroke="#fbbf24"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#gold22Gradient)"
                                                name="gold22"
                                            />
                                        )}
                                    </>
                                )}
                                {(selectedMetal === 'silver' || selectedMetal === 'both') && (
                                    <Area
                                        type="monotone"
                                        dataKey="silver"
                                        stroke="#94a3b8"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#silverGradient)"
                                        name="silver"
                                    />
                                )}
                                <Legend
                                    wrapperStyle={{ fontSize: '10px', fontWeight: '800' }}
                                    formatter={(value) => value === 'gold24' ? 'Gold 24K' : value === 'gold22' ? 'Gold 22K' : 'Silver'}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PriceTrendChart;
