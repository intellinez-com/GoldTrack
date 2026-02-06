
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, RefreshCcw, BarChart3 } from 'lucide-react';
import { getPriceHistory, PriceHistoryPoint } from '../services/firestoreService';
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

type TimeRange = '7D' | '30D' | '90D';

const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ currency, currencySymbol }) => {
    const [goldHistory, setGoldHistory] = useState<PriceHistoryPoint[]>([]);
    const [silverHistory, setSilverHistory] = useState<PriceHistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>('30D');
    const [selectedMetal, setSelectedMetal] = useState<'both' | 'gold' | 'silver'>('gold');

    const timeRangeDays: Record<TimeRange, number> = {
        '7D': 7,
        '30D': 30,
        '90D': 90
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

    // Merge gold and silver data by date for the chart
    interface ChartDataPoint {
        date: string;
        displayDate: string;
        gold?: number;
        silver?: number;
    }

    const chartData = React.useMemo(() => {
        const dataMap = new Map<string, ChartDataPoint>();

        goldHistory.forEach(point => {
            const dateKey = new Date(point.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            const existing: ChartDataPoint = dataMap.get(dateKey) || { date: point.timestamp, displayDate: dateKey, gold: undefined, silver: undefined };
            existing.gold = point.pricePerGram;
            dataMap.set(dateKey, existing);
        });

        silverHistory.forEach(point => {
            const dateKey = new Date(point.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            const existing: ChartDataPoint = dataMap.get(dateKey) || { date: point.timestamp, displayDate: dateKey, gold: undefined, silver: undefined };
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

    const goldTrend = calculateTrend(goldHistory);
    const silverTrend = calculateTrend(silverHistory);

    const hasData = chartData.length > 0;

    return (
        <div className="glass-card p-6 sm:p-8 rounded-3xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                        <BarChart3 className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Price Trend History</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">From your tracked data</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Time Range Selector */}
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                        {(['7D', '30D', '90D'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === range
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
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
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

            {/* Trend Summary Cards */}
            {hasData && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {(selectedMetal === 'gold' || selectedMetal === 'both') && goldHistory.length > 0 && (
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gold Trend</span>
                                {goldTrend.isUp ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-rose-500" />
                                )}
                            </div>
                            <p className={`text-lg font-bold ${goldTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {goldTrend.isUp ? '+' : ''}{goldTrend.percentage.toFixed(2)}%
                            </p>
                            <p className="text-xs text-slate-400">
                                {goldTrend.isUp ? '+' : ''}{currencySymbol}{goldTrend.change.toFixed(2)}/g
                            </p>
                        </div>
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
            <div className="h-[300px]">
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
                            <p className="text-slate-600 text-sm">
                                Price data will appear here as you use the app. Each time you refresh prices, the data is recorded for trend analysis.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `${currencySymbol}${v.toLocaleString()}`}
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
                                formatter={(value: number, name: string) => [
                                    `${currencySymbol}${value.toFixed(2)}/g`,
                                    name === 'gold' ? 'Gold' : 'Silver'
                                ]}
                            />
                            {(selectedMetal === 'gold' || selectedMetal === 'both') && (
                                <Area
                                    type="monotone"
                                    dataKey="gold"
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#goldGradient)"
                                    name="gold"
                                />
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
                                formatter={(value) => value === 'gold' ? 'Gold' : 'Silver'}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PriceTrendChart;
