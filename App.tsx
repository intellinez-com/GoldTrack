
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, TrendingUp, Wallet, PieChart, Trash2, RefreshCcw, Calculator, ArrowUpRight, ArrowDownRight, ExternalLink, LineChart as LineChartIcon, History, Calendar, LogOut, User as UserIcon, Settings, ChevronDown, Sparkles, Coins, Pencil, HandCoins, Gift, Percent, BarChart3, GitBranch } from 'lucide-react';
import { Investment, Purity, InvestmentType, MetalPriceData, PerformanceStats, User, SUPPORTED_CURRENCIES, AppTab, MetalType } from './types';
import { fetchLiveMetalPrice } from './services/geminiService';
import { PURITY_MULTIPLIERS, COLORS } from './constants';
import InvestmentForm from './components/InvestmentForm';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import ProfileSettings from './components/ProfileSettings';
import AIInsights from './components/AIInsights';
import GoldAdvisor from './components/GoldAdvisor';
import PriceTrendChart from './components/PriceTrendChart';
import SellInvestmentForm from './components/SellInvestmentForm';
import GiftInvestmentForm from './components/GiftInvestmentForm';
import InfoTooltip from './components/InfoTooltip';
import { onAuthChange, getCurrentUserData, logOut } from './services/authService';
import { fetchLatestPrice } from './services/historicalPriceService';
import {
  getInvestmentsByUserId,
  addInvestment as addInvestmentToFirestore,
  updateInvestment as updateInvestmentInFirestore,
  deleteInvestment as deleteInvestmentFromFirestore,
  saveMetalPrices,
  getLatestMetalPrices,
  savePriceToHistory
} from './services/firestoreService';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('portfolio');
  const [selectedMetal, setSelectedMetal] = useState<MetalType>('gold');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liveGoldPrice, setLiveGoldPrice] = useState<MetalPriceData | null>(null);
  const [liveSilverPrice, setLiveSilverPrice] = useState<MetalPriceData | null>(null);
  const [selectedGoldSourceIndex, setSelectedGoldSourceIndex] = useState(0);
  const [selectedSilverSourceIndex, setSelectedSilverSourceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [sellingInvestment, setSellingInvestment] = useState<Investment | null>(null);
  const [giftingInvestment, setGiftingInvestment] = useState<Investment | null>(null);
  const [ledgerView, setLedgerView] = useState<'active' | 'all'>('active');
  type LedgerSortKey = 'date' | 'asset' | 'purity' | 'weight' | 'consideration' | 'value' | 'roi';
  const [ledgerSort, setLedgerSort] = useState<{ key: LedgerSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [showProfile, setShowProfile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [goldSourceOpen, setGoldSourceOpen] = useState(false);
  const [silverSourceOpen, setSilverSourceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const goldSourceRef = useRef<HTMLDivElement>(null);
  const silverSourceRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<PerformanceStats>({
    totalInvested: 0,
    currentValue: 0,
    totalGain: 0,
    gainPercentage: 0
  });

  // Firebase Auth State Observer
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in - fetch user data from Firestore
        const userData = await getCurrentUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        } else {
          // Fallback if Firestore doc doesn't exist
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            avatar: firebaseUser.photoURL || ''
          });
        }
      } else {
        // User is signed out
        setUser(null);
        setInvestments([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
      if (goldSourceRef.current && !goldSourceRef.current.contains(event.target as Node)) setGoldSourceOpen(false);
      if (silverSourceRef.current && !silverSourceRef.current.contains(event.target as Node)) setSilverSourceOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load investments from Firestore when user is authenticated
  useEffect(() => {
    if (!user) return;

    const loadInvestments = async () => {
      setInvestmentsLoading(true);
      try {
        const userInvestments = await getInvestmentsByUserId(user.id);
        setInvestments(userInvestments);
      } catch (error) {
        console.error('Error loading investments:', error);
      } finally {
        setInvestmentsLoading(false);
      }
    };

    loadInvestments();
    refreshPrices();
  }, [user]);

  // NOTE: Removed legacy Gemini-based historical gold fetch which was firing on every refresh.
  // Price history is now handled via Firestore-backed `PriceTrendChart` (and optional backfill).

  // AI data is now loaded on-demand via button click to save tokens
  // The components handle their own data loading and caching

  // Load fresh prices from AI and save to DB
  const fetchAndSavePrices = async (force: boolean = false) => {
    setLoading(true);
    try {
      // Pass user sources to AI for personalized fetching
      const userSourcesForAI = user?.sources?.map(s => ({ name: s.name, url: s.url }));

      const [goldData, silverData] = await Promise.all([
        fetchLiveMetalPrice('gold', user?.currency || 'INR', userSourcesForAI),
        fetchLiveMetalPrice('silver', user?.currency || 'INR', userSourcesForAI)
      ]);

      // Fallback: if Gemini fetch fails (pricePerGram=0), use Metals.dev latest (single-source)
      const currency = user?.currency || 'INR';
      const ensurePrice = async (data: MetalPriceData, metal: 'gold' | 'silver'): Promise<MetalPriceData> => {
        if (data.pricePerGram && data.pricePerGram > 0) return data;
        const latest = await fetchLatestPrice(metal, currency);
        if (!latest || !latest.price || latest.price <= 0) return data;
        return {
          ...data,
          pricePerGram: latest.price,
          lastUpdated: new Date().toISOString(),
          quotes: [
            {
              sourceName: 'Metals.dev',
              price: latest.price,
              url: 'https://metals.dev'
            }
          ],
          sources: [{ title: 'Metals.dev', uri: 'https://metals.dev' }]
        };
      };

      const [goldResolved, silverResolved] = await Promise.all([
        ensurePrice(goldData, 'gold'),
        ensurePrice(silverData, 'silver')
      ]);

      setLiveGoldPrice(goldResolved);
      setLiveSilverPrice(silverResolved);

      // Prioritize GoodReturns as default source if available
      if (goldResolved.quotes && goldResolved.quotes.length > 0) {
        const goodReturnsIdx = goldResolved.quotes.findIndex(q =>
          q.sourceName.toLowerCase().includes('goodreturns')
        );
        setSelectedGoldSourceIndex(goodReturnsIdx >= 0 ? goodReturnsIdx : 0);
      }
      if (silverResolved.quotes && silverResolved.quotes.length > 0) {
        const goodReturnsIdx = silverResolved.quotes.findIndex(q =>
          q.sourceName.toLowerCase().includes('goodreturns')
        );
        setSelectedSilverSourceIndex(goodReturnsIdx >= 0 ? goodReturnsIdx : 0);
      }

      // Save to Firestore for caching
      if (user) {
        try {
          await saveMetalPrices([goldResolved, silverResolved]);

          // Also save to price history for trend charts
          const goldPrice = goldResolved.quotes?.[0]?.price || goldResolved.pricePerGram;
          const silverPrice = silverResolved.quotes?.[0]?.price || silverResolved.pricePerGram;
          const goldSource = goldResolved.quotes?.[0]?.sourceName;
          const silverSource = silverResolved.quotes?.[0]?.sourceName;

          if (goldPrice > 0) {
            await savePriceToHistory('gold', user.currency || 'INR', goldPrice, goldSource);
          }
          if (silverPrice > 0) {
            await savePriceToHistory('silver', user.currency || 'INR', silverPrice, silverSource);
          }
        } catch (saveError: any) {
          console.warn("Failed to cache prices to Firestore (non-critical):", saveError);
          if (saveError.code === 'permission-denied') {
            console.info("Tip: Ensure Firestore rules allow write access to 'prices' collection for authenticated users.");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching live prices:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cache TTL: 4 hours in milliseconds
  const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

  const isCacheStale = (lastUpdated: string): boolean => {
    const updatedTime = new Date(lastUpdated).getTime();
    if (!Number.isFinite(updatedTime)) return true; // invalid/missing timestamp => treat as stale
    const now = Date.now();
    return (now - updatedTime) > CACHE_TTL_MS;
  };

  const hasValidPrice = (p: MetalPriceData | undefined | null): boolean => {
    if (!p) return false;
    const quotePrice = p.quotes?.[0]?.price;
    return (typeof quotePrice === 'number' && quotePrice > 0) || (typeof p.pricePerGram === 'number' && p.pricePerGram > 0);
  };

  const refreshPrices = async (force: boolean = false) => {
    setLoading(true);

    if (!force) {
      // Try DB first
      try {
        const cachedPrices = await getLatestMetalPrices(user?.currency || 'INR');
        const gold = cachedPrices.find(p => p.metal === 'gold');
        const silver = cachedPrices.find(p => p.metal === 'silver');

        if (gold && silver) {
          // Check if cache is still fresh (within 4 hours)
          const goldStale = isCacheStale(gold.lastUpdated);
          const silverStale = isCacheStale(silver.lastUpdated);
          const goldValid = hasValidPrice(gold);
          const silverValid = hasValidPrice(silver);

          if (!goldStale && !silverStale && goldValid && silverValid) {
            // Cache is fresh, use it
            setLiveGoldPrice(gold);
            setLiveSilverPrice(silver);

            // Prioritize GoodReturns as default source if available
            if (gold.quotes && gold.quotes.length > 0) {
              const goodReturnsIdx = gold.quotes.findIndex(q =>
                q.sourceName.toLowerCase().includes('goodreturns')
              );
              setSelectedGoldSourceIndex(goodReturnsIdx >= 0 ? goodReturnsIdx : 0);
            }
            if (silver.quotes && silver.quotes.length > 0) {
              const goodReturnsIdx = silver.quotes.findIndex(q =>
                q.sourceName.toLowerCase().includes('goodreturns')
              );
              setSelectedSilverSourceIndex(goodReturnsIdx >= 0 ? goodReturnsIdx : 0);
            }

            setLoading(false);
            console.info('Using cached prices (less than 4 hours old)');
            return;
          } else {
            console.info('Cached prices are stale/invalid, fetching fresh data...', { goldStale, silverStale, goldValid, silverValid });
          }
        }
      } catch (error) {
        console.warn('Error reading cached prices, will fetch fresh:', error);
      }
    }

    // If no DB data, stale cache, or forced, fetch fresh
    await fetchAndSavePrices();
  };

  const calculateStats = useCallback(() => {
    if (!liveGoldPrice || !liveSilverPrice) return;

    // Use selected source price if available, otherwise default
    const goldPriceToUse = (liveGoldPrice.quotes && liveGoldPrice.quotes.length > selectedGoldSourceIndex)
      ? liveGoldPrice.quotes[selectedGoldSourceIndex].price
      : liveGoldPrice.pricePerGram;

    const silverPriceToUse = (liveSilverPrice.quotes && liveSilverPrice.quotes.length > selectedSilverSourceIndex)
      ? liveSilverPrice.quotes[selectedSilverSourceIndex].price
      : liveSilverPrice.pricePerGram;

    let totalInvested = 0;
    let currentValue = 0;

    investments.filter(inv => inv.status === 'HOLD').forEach(inv => {
      totalInvested += inv.totalPricePaid;
      const basePrice = inv.metal === 'gold' ? goldPriceToUse : silverPriceToUse;
      const currentPriceForPurity = basePrice * PURITY_MULTIPLIERS[inv.purity];
      currentValue += inv.weightInGrams * currentPriceForPurity;
    });

    const totalGain = currentValue - totalInvested;
    const gainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    setStats({ totalInvested, currentValue, totalGain, gainPercentage });
  }, [investments, liveGoldPrice, liveSilverPrice, selectedGoldSourceIndex, selectedSilverSourceIndex]);

  useEffect(() => {
    calculateStats();
  }, [investments, calculateStats]);

  const addInvestment = async (inv: Omit<Investment, 'userId'>) => {
    if (!user) return;

    try {
      const newInvestment = await addInvestmentToFirestore({
        userId: user.id,
        metal: inv.metal,
        purity: inv.purity,
        type: inv.type,
        dateOfPurchase: inv.dateOfPurchase,
        weightInGrams: inv.weightInGrams,
        totalPricePaid: inv.totalPricePaid,
        purchasePricePerGram: inv.purchasePricePerGram,
        units: inv.units,
        navPerUnit: inv.navPerUnit,
        purchasePricePerUnit: inv.purchasePricePerUnit,
        status: 'HOLD'
      });

      setInvestments(prev => [newInvestment, ...prev]);
      setShowForm(false);
    } catch (error) {
      console.error('Error adding investment:', error);
      alert('Failed to save investment. Please try again.');
    }
  };

  const updateInvestment = async (inv: Omit<Investment, 'userId'>) => {
    try {
      await updateInvestmentInFirestore(inv.id, {
        metal: inv.metal,
        purity: inv.purity,
        type: inv.type,
        dateOfPurchase: inv.dateOfPurchase,
        weightInGrams: inv.weightInGrams,
        totalPricePaid: inv.totalPricePaid,
        purchasePricePerGram: inv.purchasePricePerGram,
        units: inv.units,
        navPerUnit: inv.navPerUnit,
        purchasePricePerUnit: inv.purchasePricePerUnit
      });
      setInvestments(prev => prev.map(p => (p.id === inv.id ? { ...p, ...inv } as Investment : p)));
      setEditingInvestment(null);
    } catch (error) {
      console.error('Error updating investment:', error);
      alert('Failed to update investment. Please try again.');
    }
  };

  const markInvestmentSold = async (invId: string, sale: { soldAt: string; saleTotalReceived: number; salePricePerGram: number }) => {
    try {
      await updateInvestmentInFirestore(invId, {
        status: 'SOLD',
        soldAt: sale.soldAt,
        saleTotalReceived: sale.saleTotalReceived,
        salePricePerGram: sale.salePricePerGram
      });
      setInvestments(prev =>
        prev.map(p => (p.id === invId ? ({ ...p, status: 'SOLD', ...sale } as Investment) : p))
      );
      setSellingInvestment(null);
    } catch (error) {
      console.error('Error selling investment:', error);
      alert('Failed to mark asset as sold. Please try again.');
    }
  };

  const markInvestmentGifted = async (invId: string, gift: { giftedAt: string; giftedMarketValue: number; giftedNotes?: string }) => {
    try {
      await updateInvestmentInFirestore(invId, {
        status: 'GIFTED',
        giftedAt: gift.giftedAt,
        giftedMarketValue: gift.giftedMarketValue,
        giftedNotes: gift.giftedNotes || null
      });
      setInvestments(prev =>
        prev.map(p => (p.id === invId ? ({ ...p, status: 'GIFTED', ...gift } as Investment) : p))
      );
      setGiftingInvestment(null);
    } catch (error) {
      console.error('Error gifting investment:', error);
      alert('Failed to mark asset as gifted. Please try again.');
    }
  };

  const removeInvestment = async (id: string) => {
    try {
      await deleteInvestmentFromFirestore(id);
      setInvestments(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting investment:', error);
      alert('Failed to delete investment. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);
      setInvestments([]);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    setShowProfile(false);
  };

  const currentCurrency = useMemo(() => {
    const code = user?.currency || 'INR';
    return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
  }, [user]);

  const activeHoldings = useMemo(() => investments.filter(i => i.status === 'HOLD'), [investments]);
  const ledgerInvestments = useMemo(
    () => (ledgerView === 'active' ? activeHoldings : investments),
    [ledgerView, activeHoldings, investments]
  );

  const ledgerRows = useMemo(() => {
    const goldPriceToUse = (liveGoldPrice?.quotes && liveGoldPrice.quotes.length > selectedGoldSourceIndex)
      ? liveGoldPrice.quotes[selectedGoldSourceIndex].price
      : (liveGoldPrice?.pricePerGram || 0);

    const silverPriceToUse = (liveSilverPrice?.quotes && liveSilverPrice.quotes.length > selectedSilverSourceIndex)
      ? liveSilverPrice.quotes[selectedSilverSourceIndex].price
      : (liveSilverPrice?.pricePerGram || 0);

    const rows = ledgerInvestments.map((inv, idx) => {
      const basePrice = inv.metal === 'gold' ? goldPriceToUse : silverPriceToUse;
      const currentUnitPrice = (basePrice || 0) * PURITY_MULTIPLIERS[inv.purity];
      const isSold = inv.status === 'SOLD';
      const isGifted = inv.status === 'GIFTED';
      const currentValue = currentUnitPrice * inv.weightInGrams;
      const displayedValue = isSold ? (inv.saleTotalReceived || 0) : isGifted ? (inv.giftedMarketValue || 0) : currentValue;
      const gain = displayedValue - inv.totalPricePaid;
      const roiPercent = inv.totalPricePaid > 0 ? (gain / inv.totalPricePaid) * 100 : 0;
      const assetLabel = `${inv.metal} ${inv.type}`.toUpperCase();
      const dateTs = new Date(inv.dateOfPurchase).getTime();
      return {
        idx,
        inv,
        isSold,
        isGifted,
        displayedValue,
        roiPercent,
        assetLabel,
        purityLabel: inv.purity,
        weight: inv.weightInGrams,
        consideration: inv.totalPricePaid,
        dateTs
      };
    });

    const dirMul = ledgerSort.dir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (ledgerSort.key) {
        case 'date':
          cmp = (a.dateTs - b.dateTs);
          break;
        case 'asset':
          cmp = a.assetLabel.localeCompare(b.assetLabel);
          break;
        case 'purity':
          cmp = String(a.purityLabel).localeCompare(String(b.purityLabel));
          break;
        case 'weight':
          cmp = (a.weight - b.weight);
          break;
        case 'consideration':
          cmp = (a.consideration - b.consideration);
          break;
        case 'value':
          cmp = (a.displayedValue - b.displayedValue);
          break;
        case 'roi':
          cmp = (a.roiPercent - b.roiPercent);
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) return (a.idx - b.idx); // stable
      return cmp * dirMul;
    });

    return sorted;
  }, [
    ledgerInvestments,
    liveGoldPrice,
    liveSilverPrice,
    selectedGoldSourceIndex,
    selectedSilverSourceIndex,
    ledgerSort.key,
    ledgerSort.dir
  ]);

  const toggleLedgerSort = (key: LedgerSortKey) => {
    setLedgerSort(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortIndicator = (key: LedgerSortKey) => {
    if (ledgerSort.key !== key) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-amber-400 ml-1">{ledgerSort.dir === 'asc' ? '▲' : '▼'}</span>;
  };

  const holdingSummary = useMemo(() => {
    // Weighted averages: avg purchase price per gram = sum(totalPaid) / sum(weight)
    const make = () => ({ weight: 0, totalPaid: 0 });
    const groups: Record<string, ReturnType<typeof make>> = {
      '24K': make(),
      '22K': make(),
      '18K': make(),
      SILVER: make()
    };

    for (const inv of activeHoldings) {
      if (inv.metal === 'gold') {
        const key = inv.purity === Purity.K24 ? '24K' : inv.purity === Purity.K22 ? '22K' : inv.purity === Purity.K18 ? '18K' : null;
        if (!key) continue;
        groups[key].weight += inv.weightInGrams;
        groups[key].totalPaid += inv.totalPricePaid;
      } else {
        groups.SILVER.weight += inv.weightInGrams;
        groups.SILVER.totalPaid += inv.totalPricePaid;
      }
    }

    const avg = (g: { weight: number; totalPaid: number }) => (g.weight > 0 ? g.totalPaid / g.weight : 0);
    return {
      gold24: { weight: groups['24K'].weight, avgPpg: avg(groups['24K']) },
      gold22: { weight: groups['22K'].weight, avgPpg: avg(groups['22K']) },
      gold18: { weight: groups['18K'].weight, avgPpg: avg(groups['18K']) },
      silver: { weight: groups.SILVER.weight, avgPpg: avg(groups.SILVER) }
    };
  }, [activeHoldings]);

  const currentUnitPrices = useMemo(() => {
    const goldPriceToUse = (liveGoldPrice?.quotes && liveGoldPrice.quotes.length > selectedGoldSourceIndex)
      ? liveGoldPrice.quotes[selectedGoldSourceIndex].price
      : (liveGoldPrice?.pricePerGram || 0);

    const silverPriceToUse = (liveSilverPrice?.quotes && liveSilverPrice.quotes.length > selectedSilverSourceIndex)
      ? liveSilverPrice.quotes[selectedSilverSourceIndex].price
      : (liveSilverPrice?.pricePerGram || 0);

    return {
      gold24: goldPriceToUse * PURITY_MULTIPLIERS[Purity.K24],
      gold22: goldPriceToUse * PURITY_MULTIPLIERS[Purity.K22],
      gold18: goldPriceToUse * PURITY_MULTIPLIERS[Purity.K18],
      silver: silverPriceToUse
    };
  }, [liveGoldPrice, liveSilverPrice, selectedGoldSourceIndex, selectedSilverSourceIndex]);

  const realizedSummary = useMemo(() => {
    const sold = investments.filter(i => i.status === 'SOLD' && typeof i.saleTotalReceived === 'number');
    const realizedInvested = sold.reduce((sum, i) => sum + (i.totalPricePaid || 0), 0);
    const realizedReceived = sold.reduce((sum, i) => sum + (i.saleTotalReceived || 0), 0);
    const realizedProfit = realizedReceived - realizedInvested;
    const realizedPct = realizedInvested > 0 ? (realizedProfit / realizedInvested) * 100 : 0;
    return { soldCount: sold.length, realizedInvested, realizedReceived, realizedProfit, realizedPct };
  }, [investments]);

  const giftedSummary = useMemo(() => {
    const gifted = investments.filter(i => i.status === 'GIFTED' && typeof i.giftedMarketValue === 'number');
    const giftedCost = gifted.reduce((sum, i) => sum + (i.totalPricePaid || 0), 0);
    const giftedValue = gifted.reduce((sum, i) => sum + (i.giftedMarketValue || 0), 0);
    return { giftedCount: gifted.length, giftedCost, giftedValue };
  }, [investments]);

  // ── Reporting Metrics: Absolute ROI, CAGR, XIRR ──────────────────────
  const reportingMetrics = useMemo(() => {
    const totalInvested = stats.totalInvested;
    const currentValue = stats.currentValue;

    // 1) Absolute ROI = (Current Value - Invested) / Invested × 100
    const absoluteROI = totalInvested > 0
      ? ((currentValue - totalInvested) / totalInvested) * 100
      : 0;

    // 2) CAGR = (CurrentValue / Invested)^(1/years) - 1
    //    Use the weighted-average holding period from the earliest purchase
    const holdInvestments = investments.filter(i => i.status === 'HOLD');
    let cagr = 0;
    if (totalInvested > 0 && holdInvestments.length > 0) {
      const dates = holdInvestments.map(i => new Date(i.dateOfPurchase).getTime());
      const earliestMs = Math.min(...dates);
      const nowMs = Date.now();
      const yearsHeld = (nowMs - earliestMs) / (365.25 * 24 * 60 * 60 * 1000);
      if (yearsHeld > 0 && currentValue > 0) {
        cagr = (Math.pow(currentValue / totalInvested, 1 / yearsHeld) - 1) * 100;
      }
    }

    // 3) XIRR – true internal rate of return for irregular cash flows
    //    Each purchase is a negative cash flow on its date.
    //    Today's portfolio value is a single positive terminal cash flow.
    let xirr = 0;
    if (totalInvested > 0 && holdInvestments.length > 0 && currentValue > 0) {
      // Build cash-flow array: [{amount, date}]
      const cashFlows: { amount: number; date: Date }[] = holdInvestments.map(inv => ({
        amount: -inv.totalPricePaid,
        date: new Date(inv.dateOfPurchase)
      }));
      // Terminal inflow = current portfolio value today
      cashFlows.push({ amount: currentValue, date: new Date() });

      // Newton-Raphson solver for XIRR
      const calcXIRR = (flows: { amount: number; date: Date }[], guess: number = 0.1, maxIter: number = 100, tol: number = 1e-7): number | null => {
        const d0 = flows[0].date.getTime();
        let rate = guess;
        for (let i = 0; i < maxIter; i++) {
          let npv = 0;
          let dnpv = 0;
          for (const cf of flows) {
            const years = (cf.date.getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000);
            const factor = Math.pow(1 + rate, years);
            if (!Number.isFinite(factor) || factor === 0) return null;
            npv += cf.amount / factor;
            dnpv -= (years * cf.amount) / (factor * (1 + rate));
          }
          if (Math.abs(dnpv) < 1e-15) return null; // avoid div-by-zero
          const newRate = rate - npv / dnpv;
          if (Math.abs(newRate - rate) < tol) return newRate;
          rate = newRate;
          if (!Number.isFinite(rate)) return null;
        }
        return rate; // last approximation
      };

      const xirrResult = calcXIRR(cashFlows);
      if (xirrResult !== null && Number.isFinite(xirrResult)) {
        xirr = xirrResult * 100;
      }
    }

    return { absoluteROI, cagr, xirr };
  }, [stats.totalInvested, stats.currentValue, investments]);

  const portfolioPerformanceData = useMemo(() => {
    if (investments.length === 0 || !liveGoldPrice || !liveSilverPrice) return [];

    const goldPriceToUse = (liveGoldPrice.quotes && liveGoldPrice.quotes.length > selectedGoldSourceIndex)
      ? liveGoldPrice.quotes[selectedGoldSourceIndex].price
      : liveGoldPrice.pricePerGram;

    const silverPriceToUse = (liveSilverPrice.quotes && liveSilverPrice.quotes.length > selectedSilverSourceIndex)
      ? liveSilverPrice.quotes[selectedSilverSourceIndex].price
      : liveSilverPrice.pricePerGram;

    const sorted = [...investments].filter(inv => inv.status === 'HOLD').sort((a, b) => new Date(a.dateOfPurchase).getTime() - new Date(b.dateOfPurchase).getTime());
    let cumulativeInvested = 0;
    let cumulativeCurrentValue = 0;
    const points = sorted.map((inv) => {
      cumulativeInvested += inv.totalPricePaid;
      const basePrice = inv.metal === 'gold' ? goldPriceToUse : silverPriceToUse;
      const currentUnitPrice = basePrice * PURITY_MULTIPLIERS[inv.purity];
      cumulativeCurrentValue += inv.weightInGrams * currentUnitPrice;
      return {
        dateISO: inv.dateOfPurchase,
        dateLabel: new Date(inv.dateOfPurchase).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        invested: cumulativeInvested,
        currentValue: cumulativeCurrentValue
      };
    });

    // Append "today" point so the trajectory always ends at present day
    if (points.length > 0) {
      const todayISO = new Date().toISOString().split('T')[0];
      const last = points[points.length - 1];
      if (last.dateISO !== todayISO) {
        points.push({
          dateISO: todayISO,
          dateLabel: new Date(todayISO).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          invested: last.invested,
          currentValue: last.currentValue
        });
      }
    }

    return points;
  }, [investments, liveGoldPrice, liveSilverPrice, selectedGoldSourceIndex, selectedSilverSourceIndex]);

  const mixData = useMemo(() => {
    return investments.filter(inv => inv.status === 'HOLD').reduce((acc: any[], inv) => {
      const existing = acc.find(item => item.name === inv.metal.toUpperCase());
      if (existing) {
        existing.value += inv.totalPricePaid;
      } else {
        acc.push({ name: inv.metal.toUpperCase(), value: inv.totalPricePaid });
      }
      return acc;
    }, []);
  }, [investments]);

  const performanceColors = [COLORS.GOLD, COLORS.SILVER];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currentCurrency.code,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDateWithYear = (isoOrDate: string | Date) => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const AllocationTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = stats.totalInvested > 0 ? (data.value / stats.totalInvested) * 100 : 0;
      return (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-2xl min-w-[190px]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">{data.name} Allocation</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-4"><span className="text-xs text-slate-400">Total Spent:</span><span className="text-xs font-bold text-amber-400">{formatCurrency(data.value)}</span></div>
            <div className="flex justify-between items-center gap-4"><span className="text-xs text-slate-400">Share:</span><span className="text-xs font-black text-emerald-400">{percentage.toFixed(1)}%</span></div>
          </div>
        </div>
      );
    }
    return null;
  };

  const ValuationTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0]?.payload;
    const dateLabel = p?.dateLabel || '—';

    const valueByKey = (key: string) => {
      const item = payload.find((x: any) => x.dataKey === key);
      return typeof item?.value === 'number' ? item.value : null;
    };

    const market = valueByKey('currentValue');
    const invested = valueByKey('invested');

    return (
      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-2xl min-w-[220px]">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">
          {dateLabel}
        </p>
        <div className="space-y-2">
          {typeof market === 'number' && (
            <div className="flex justify-between items-center gap-6">
              <span className="text-xs text-slate-400 font-bold">Market Value</span>
              <span className="text-xs font-black text-amber-400">{formatCurrency(market)}</span>
            </div>
          )}
          {typeof invested === 'number' && (
            <div className="flex justify-between items-center gap-6">
              <span className="text-xs text-slate-400 font-bold">Invested</span>
              <span className="text-xs font-black text-slate-200">{formatCurrency(invested)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Show loading screen while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b1222] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 gold-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <TrendingUp className="text-white w-8 h-8" />
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Initializing Vault...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Go directly to Auth screen (login/signup)
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen pb-24 bg-[#0b1222]" style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 6rem))' }}>
      <header className="sticky top-0 z-30 glass-card px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700/50">
        {/* Row 1: Logo + User Menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <TrendingUp className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">MetalTrack <span className="text-amber-500">Analytics</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none mt-1">Multi-Asset Intelligence</p>
            </div>
          </div>

          {/* Tabs — inline on sm+, hidden on mobile (shown below) */}
          <div className="hidden sm:flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800 ml-8">
            <button onClick={() => setActiveTab('portfolio')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'portfolio' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Wallet className="w-3 h-3" />Portfolio</button>
            <button onClick={() => setActiveTab('insights')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'insights' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Sparkles className="w-3 h-3" />AI Insights</button>
            <button onClick={() => setActiveTab('advisor')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'advisor' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Calculator className="w-3 h-3" />Advisor</button>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-6 border-r border-slate-800 relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 sm:gap-3 hover:bg-slate-800/50 p-1 rounded-xl sm:rounded-2xl transition-all group">
                <div className="w-8 h-8 rounded-full border border-amber-500/30 overflow-hidden bg-slate-800 flex items-center justify-center shadow-lg group-hover:border-amber-500 shrink-0">
                  {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Account Vault</span>
                  <span className="text-xs font-bold text-slate-200 truncate max-w-[80px]">{user.name}</span>
                </div>
                <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isMenuOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-slate-800 mb-2"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Access Level</p><p className="text-xs font-bold text-amber-500 truncate">{user.email}</p></div>
                  <button onClick={() => { setShowProfile(true); setIsMenuOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"><Settings className="w-4 h-4 text-amber-500" />Vault Settings</button>
                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <button onClick={handleLogout} className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all"><LogOut className="w-4 h-4" />End Session</button>
                </div>
              )}
            </div>
            <button onClick={() => refreshPrices(true)} className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg sm:rounded-xl transition-all text-slate-300 shadow-lg border border-slate-700/50 active:scale-95">
              <RefreshCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Tabs — full width on mobile only */}
        <div className="flex sm:hidden bg-slate-900/50 p-1 rounded-2xl border border-slate-800 mt-3 w-full">
          <button onClick={() => setActiveTab('portfolio')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'portfolio' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Wallet className="w-3 h-3" />Portfolio</button>
          <button onClick={() => setActiveTab('insights')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'insights' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Sparkles className="w-3 h-3" />Insights</button>
          <button onClick={() => setActiveTab('advisor')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'advisor' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Calculator className="w-3 h-3" />Advisor</button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-8 space-y-8">
        {activeTab === 'portfolio' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <StatCard title="Principal Invested" value={formatCurrency(stats.totalInvested)} infoText="Total amount deployed into currently active holdings." icon={<Wallet className="w-5 h-5" />} />
              <StatCard title="Market Valuation" value={formatCurrency(stats.currentValue)} infoText="Live mark-to-market value of all active holdings at selected spot rates." icon={<TrendingUp className="w-5 h-5 text-amber-500" />} />
              <StatCard title="Net P/L Performance" value={`${stats.totalGain >= 0 ? '+' : ''}${formatCurrency(stats.totalGain)}`} subtitle={`${stats.gainPercentage.toFixed(2)}%`} isPositive={stats.totalGain >= 0} infoText="Unrealized gain/loss for active holdings only (excludes sold and gifted entries)." icon={stats.totalGain >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : <ArrowDownRight className="w-5 h-5 text-rose-500" />} />
              <div className="glass-card p-4 sm:p-7 rounded-2xl sm:rounded-3xl h-28 sm:h-40 border-2 border-dashed border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer group flex flex-col justify-between border-b-4 border-b-amber-500/20 hover:border-b-amber-500/50" onClick={() => setShowForm(true)}>
                <div className="flex justify-end">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-amber-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-amber-500/20">
                    <Plus className="w-4 h-4 sm:w-7 sm:h-7 text-amber-500" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-4">
                  <span className="block font-black text-amber-500 text-sm sm:text-base leading-tight">New Acquisition</span>
                  <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-[0.12em] sm:tracking-widest font-bold">Add to Portfolio</span>
                </div>
              </div>
            </div>

            {/* ── Reporting Row: Absolute ROI · CAGR · XIRR ──────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              {/* Absolute ROI */}
              <div className="glass-card p-4 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col justify-between h-28 sm:h-40 border-b-4 border-b-transparent hover:border-b-amber-500/50 transition-all duration-300 group shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight flex items-center gap-1.5">
                      Absolute ROI
                      <InfoTooltip content="Total return percentage from inception: (current value - invested) / invested." />
                    </span>
                    <span className="text-[7px] sm:text-[9px] text-slate-600 font-medium mt-0.5 block leading-tight">Total growth from inception to today</span>
                  </div>
                  <div className="p-1.5 sm:p-3 bg-slate-800/80 rounded-xl sm:rounded-2xl group-hover:bg-amber-500/10 group-hover:scale-110 transition-all border border-slate-700/50 shadow-inner">
                    <Percent className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-4">
                  <div className={`text-xl sm:text-3xl font-black tracking-tight ${reportingMetrics.absoluteROI >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {reportingMetrics.absoluteROI >= 0 ? '+' : ''}{reportingMetrics.absoluteROI.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* CAGR (Annualized) */}
              <div className="glass-card p-4 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col justify-between h-28 sm:h-40 border-b-4 border-b-transparent hover:border-b-amber-500/50 transition-all duration-300 group shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight flex items-center gap-1.5">
                      CAGR (Annualized)
                      <InfoTooltip content="Annualized growth rate based on current value, invested amount, and holding period." />
                    </span>
                    <span className="text-[7px] sm:text-[9px] text-slate-600 font-medium mt-0.5 block leading-tight">Compound Annual Growth Rate</span>
                  </div>
                  <div className="p-1.5 sm:p-3 bg-slate-800/80 rounded-xl sm:rounded-2xl group-hover:bg-amber-500/10 group-hover:scale-110 transition-all border border-slate-700/50 shadow-inner">
                    <BarChart3 className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-4">
                  <div className={`text-xl sm:text-3xl font-black tracking-tight ${reportingMetrics.cagr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {reportingMetrics.cagr >= 0 ? '+' : ''}{reportingMetrics.cagr.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* XIRR (Internal Return) */}
              <div className="glass-card p-4 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col justify-between h-28 sm:h-40 border-b-4 border-b-transparent hover:border-b-amber-500/50 transition-all duration-300 group shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight flex items-center gap-1.5">
                      XIRR (Internal Return)
                      <InfoTooltip content="Cash-flow-based annualized return for irregular purchase dates using an internal-rate solver." />
                    </span>
                    <span className="text-[7px] sm:text-[9px] text-slate-600 font-medium mt-0.5 block leading-tight">Actual return on cash flows</span>
                  </div>
                  <div className="p-1.5 sm:p-3 bg-slate-800/80 rounded-xl sm:rounded-2xl group-hover:bg-amber-500/10 group-hover:scale-110 transition-all border border-slate-700/50 shadow-inner">
                    <GitBranch className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-4">
                  <div className={`text-xl sm:text-3xl font-black tracking-tight ${reportingMetrics.xirr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {reportingMetrics.xirr >= 0 ? '+' : ''}{reportingMetrics.xirr.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {realizedSummary.soldCount > 0 && (
              <div className="glass-card p-4 sm:p-6 rounded-3xl border border-slate-700/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    Realized Profit (Sold Assets)
                    <InfoTooltip content="Booked profit/loss from sold entries only: received amount minus invested cost of sold lots." />
                  </p>
                  <div className="flex items-end gap-2 sm:gap-3 mt-2">
                    <span className={`text-xl sm:text-2xl font-black ${realizedSummary.realizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {realizedSummary.realizedProfit >= 0 ? '+' : ''}{formatCurrency(realizedSummary.realizedProfit)}
                    </span>
                    <span className={`text-[10px] sm:text-xs font-black ${realizedSummary.realizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({realizedSummary.realizedPct >= 0 ? '+' : ''}{realizedSummary.realizedPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 bg-slate-900/40 border border-slate-800 rounded-2xl px-4 sm:px-5 py-3 w-full sm:w-auto justify-around sm:justify-start">
                  <div className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">Sold</div>
                    <div className="text-xs sm:text-sm font-black text-slate-200 font-mono">{realizedSummary.soldCount}</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 bg-slate-800"></div>
                  <div className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">Invested</div>
                    <div className="text-xs sm:text-sm font-black text-slate-200 font-mono">{formatCurrency(realizedSummary.realizedInvested)}</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 bg-slate-800"></div>
                  <div className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">Received</div>
                    <div className="text-xs sm:text-sm font-black text-slate-200 font-mono">{formatCurrency(realizedSummary.realizedReceived)}</div>
                  </div>
                </div>
              </div>
            )}

            {giftedSummary.giftedCount > 0 && (
              <div className="glass-card p-4 sm:p-6 rounded-3xl border border-slate-700/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    Transferred Out (Gifted)
                    <InfoTooltip content="Tracks assets marked as gifted. These are excluded from active valuation and net P/L." />
                  </p>
                  <div className="flex items-end gap-2 sm:gap-3 mt-2">
                    <span className="text-xl sm:text-2xl font-black text-violet-400">
                      {formatCurrency(giftedSummary.giftedValue)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-slate-500">
                      saved market value
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 bg-slate-900/40 border border-slate-800 rounded-2xl px-4 sm:px-5 py-3 w-full sm:w-auto justify-around sm:justify-start">
                  <div className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">Gifted</div>
                    <div className="text-xs sm:text-sm font-black text-slate-200 font-mono">{giftedSummary.giftedCount}</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 bg-slate-800"></div>
                  <div className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">Cost basis</div>
                    <div className="text-xs sm:text-sm font-black text-slate-200 font-mono">{formatCurrency(giftedSummary.giftedCost)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-4 sm:p-8 rounded-3xl border border-slate-700/30">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-3">
                    <Coins className="w-5 h-5 text-amber-500" />
                    Holdings Snapshot
                    <InfoTooltip content="Shows net active weight, average buy price, and live spot comparison for each metal bucket." />
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Weight + avg cost vs current spot</p>
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Active items: <span className="text-slate-200 font-black font-mono">{activeHoldings.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: '24K Gold', weight: holdingSummary.gold24.weight, avg: holdingSummary.gold24.avgPpg, cur: currentUnitPrices.gold24, color: 'text-amber-400' },
                  { label: '22K Gold', weight: holdingSummary.gold22.weight, avg: holdingSummary.gold22.avgPpg, cur: currentUnitPrices.gold22, color: 'text-amber-400' },
                  { label: '18K Gold', weight: holdingSummary.gold18.weight, avg: holdingSummary.gold18.avgPpg, cur: currentUnitPrices.gold18, color: 'text-amber-400' },
                  { label: 'Silver', weight: holdingSummary.silver.weight, avg: holdingSummary.silver.avgPpg, cur: currentUnitPrices.silver, color: 'text-slate-300' }
                ].map((row) => (
                  <div key={row.label} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 sm:p-5 min-w-0">
                    <div className="flex items-center justify-between mb-2.5 gap-2 min-w-0">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{row.label}</span>
                      <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200 shrink-0">{row.weight.toFixed(2)}g</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-[11px] sm:text-xs text-slate-500 font-bold shrink-0">Avg price</span>
                        <span className={`text-[10px] sm:text-xs font-black ${row.color} font-mono tabular-nums whitespace-nowrap text-right leading-tight shrink-0`}>{currentCurrency.symbol}{row.avg ? row.avg.toFixed(2) : '0.00'}/g</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-[11px] sm:text-xs text-slate-500 font-bold shrink-0">Current</span>
                        <span className="text-[10px] sm:text-xs font-black text-emerald-400 font-mono tabular-nums whitespace-nowrap text-right leading-tight shrink-0">{currentCurrency.symbol}{row.cur ? row.cur.toFixed(2) : '0.00'}/g</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-xl relative z-20">
              {/* Title + Timestamp Row */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    Live Gold Rates
                    <InfoTooltip content="Live source-linked per-gram spot rates for 24K, 22K, and 999 silver. Tap source chips on mobile to switch quote provider." />
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold">
                  <History className="w-3 h-3" /><span className="hidden sm:inline">Updated: </span><span>{new Date(liveGoldPrice?.lastUpdated || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Prices Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4">
                <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">24K Gold</span>
                    {liveGoldPrice?.quotes && liveGoldPrice.quotes.length > 0 && (
                      <button
                        onClick={() => { setGoldSourceOpen(!goldSourceOpen); setSilverSourceOpen(false); }}
                        className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-1.5 rounded border border-slate-700 cursor-pointer hidden sm:inline-flex items-center gap-1 transition-colors"
                      >
                        {liveGoldPrice.quotes[selectedGoldSourceIndex]?.sourceName || liveGoldPrice.quotes[0]?.sourceName}
                        <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform ${goldSourceOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-bold text-xl sm:text-2xl text-slate-200">
                    {(liveGoldPrice?.quotes?.[selectedGoldSourceIndex]?.price || liveGoldPrice?.pricePerGram || 0) > 0 ? (
                      <>
                        {currentCurrency.symbol}
                        {((liveGoldPrice?.quotes?.[selectedGoldSourceIndex]?.price || liveGoldPrice?.pricePerGram || 0)).toFixed(2)}
                      </>
                    ) : (
                      '---'
                    )}
                    <span className="text-sm text-slate-500 font-medium ml-1">/g</span>
                  </span>
                  {/* Desktop click dropdown */}
                  {goldSourceOpen && liveGoldPrice?.quotes && liveGoldPrice.quotes.length > 0 && (
                    <div className="hidden sm:block absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" ref={goldSourceRef}>
                      <div className="p-3 border-b border-slate-800"><p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Select Gold Source</p></div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {liveGoldPrice.quotes.map((q, idx) => (
                          <button key={idx} onClick={() => { setSelectedGoldSourceIndex(idx); setGoldSourceOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${selectedGoldSourceIndex === idx ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{q.sourceName}</span>
                              <span className="text-[10px] opacity-70">Price: {currentCurrency.symbol}{q.price}</span>
                            </div>
                            {selectedGoldSourceIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">22K Gold</span>
                    {liveGoldPrice?.quotes && liveGoldPrice.quotes.length > 0 && <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 rounded border border-slate-700 hidden sm:inline-block">{liveGoldPrice.quotes[selectedGoldSourceIndex]?.sourceName || liveGoldPrice.quotes[0]?.sourceName}</span>}
                  </div>
                  <span className="font-mono font-bold text-xl sm:text-2xl text-slate-200">
                    {(liveGoldPrice?.quotes?.[selectedGoldSourceIndex]?.price || liveGoldPrice?.pricePerGram || 0) > 0 ? (
                      <>
                        {currentCurrency.symbol}
                        {((liveGoldPrice?.quotes?.[selectedGoldSourceIndex]?.price || liveGoldPrice?.pricePerGram || 0) * PURITY_MULTIPLIERS[Purity.K22]).toFixed(2)}
                      </>
                    ) : (
                      '---'
                    )}
                    <span className="text-sm text-slate-500 font-medium ml-1">/g</span>
                  </span>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">999 Silver</span>
                    {liveSilverPrice?.quotes && liveSilverPrice.quotes.length > 0 && (
                      <button
                        onClick={() => { setSilverSourceOpen(!silverSourceOpen); setGoldSourceOpen(false); }}
                        className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-1.5 rounded border border-slate-700 cursor-pointer hidden sm:inline-flex items-center gap-1 transition-colors"
                      >
                        {liveSilverPrice.quotes[selectedSilverSourceIndex]?.sourceName || liveSilverPrice.quotes[0]?.sourceName}
                        <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform ${silverSourceOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-bold text-xl sm:text-2xl text-slate-200">
                    {(liveSilverPrice?.quotes?.[selectedSilverSourceIndex]?.price || liveSilverPrice?.pricePerGram || 0) > 0 ? (
                      <>
                        {currentCurrency.symbol}
                        {((liveSilverPrice?.quotes?.[selectedSilverSourceIndex]?.price || liveSilverPrice?.pricePerGram || 0)).toFixed(2)}
                      </>
                    ) : (
                      '---'
                    )}
                    <span className="text-sm text-slate-500 font-medium ml-1">/g</span>
                  </span>
                  {/* Desktop click dropdown */}
                  {silverSourceOpen && liveSilverPrice?.quotes && liveSilverPrice.quotes.length > 0 && (
                    <div className="hidden sm:block absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" ref={silverSourceRef}>
                      <div className="p-3 border-b border-slate-800"><p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Select Silver Source</p></div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {liveSilverPrice.quotes.map((q, idx) => (
                          <button key={idx} onClick={() => { setSelectedSilverSourceIndex(idx); setSilverSourceOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${selectedSilverSourceIndex === idx ? 'bg-slate-500/10 text-slate-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{q.sourceName}</span>
                              <span className="text-[10px] opacity-70">Price: {currentCurrency.symbol}{q.price}</span>
                            </div>
                            {selectedSilverSourceIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile-only Source Selectors (click-based for touch) */}
              <div className="flex sm:hidden flex-wrap gap-2 items-center">
                {liveGoldPrice?.quotes && liveGoldPrice.quotes.length > 0 && (
                  <div className="relative" ref={goldSourceRef}>
                    <button
                      onClick={() => { setGoldSourceOpen(!goldSourceOpen); setSilverSourceOpen(false); }}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {liveGoldPrice.quotes[selectedGoldSourceIndex].sourceName}
                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${goldSourceOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {goldSourceOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-slate-800"><p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Select Gold Source</p></div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                          {liveGoldPrice.quotes.map((q, idx) => (
                            <button key={idx} onClick={() => { setSelectedGoldSourceIndex(idx); setGoldSourceOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${selectedGoldSourceIndex === idx ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{q.sourceName}</span>
                                <span className="text-[10px] opacity-70">Price: {currentCurrency.symbol}{q.price}</span>
                              </div>
                              {selectedGoldSourceIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {liveSilverPrice?.quotes && liveSilverPrice.quotes.length > 0 && (
                  <div className="relative" ref={silverSourceRef}>
                    <button
                      onClick={() => { setSilverSourceOpen(!silverSourceOpen); setGoldSourceOpen(false); }}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      {liveSilverPrice.quotes[selectedSilverSourceIndex].sourceName}
                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${silverSourceOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {silverSourceOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-slate-800"><p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Select Silver Source</p></div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                          {liveSilverPrice.quotes.map((q, idx) => (
                            <button key={idx} onClick={() => { setSelectedSilverSourceIndex(idx); setSilverSourceOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${selectedSilverSourceIndex === idx ? 'bg-slate-500/10 text-slate-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{q.sourceName}</span>
                                <span className="text-[10px] opacity-70">Price: {currentCurrency.symbol}{q.price}</span>
                              </div>
                              {selectedSilverSourceIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-8">
              <div className="xl:col-span-2 glass-card p-4 sm:p-8 rounded-3xl min-h-[350px] sm:min-h-[450px]">
                <h3 className="text-base sm:text-xl font-bold flex items-center gap-2 sm:gap-3 mb-6 sm:mb-10">
                  <LineChartIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                  Valuation Trajectory
                  <InfoTooltip content="Compares invested capital vs current market value over time so you can track portfolio growth momentum." />
                </h3>
                <div className="h-[260px] sm:h-[320px] overflow-x-auto custom-scrollbar">
                  {portfolioPerformanceData.length > 0 ? (
                    <div className="min-w-[600px] h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={portfolioPerformanceData}>
                          <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.GOLD} stopOpacity={0.4} /><stop offset="95%" stopColor={COLORS.GOLD} stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="dateLabel" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} dx={-5} width={55} tickFormatter={(v) => `${currentCurrency.symbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                          <Tooltip content={<ValuationTooltip />} />
                          <Area type="monotone" dataKey="currentValue" name="Market Value" stroke={COLORS.GOLD} strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" animationDuration={2000} />
                          <Area type="monotone" dataKey="invested" name="Invested" stroke="#475569" strokeWidth={2} strokeDasharray="8 4" fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-full flex items-center justify-center text-slate-500 italic text-xs sm:text-sm">{investmentsLoading ? 'Loading investments...' : 'Portfolio data visualization will populate after first entry.'}</div>}
                </div>
              </div>
              <div className="xl:col-span-1 glass-card p-4 sm:p-8 rounded-3xl flex flex-col min-h-[350px] sm:min-h-[400px]">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
                  <PieChart className="w-6 h-6 text-amber-500" />
                  Metal Diversification
                  <InfoTooltip content="Breakdown of total portfolio value share across metals to quickly spot concentration risk." />
                </h3>
                <div className="flex-1 min-h-[220px]">
                  {mixData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie data={mixData} cx="50%" cy="40%" innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">
                          {mixData.map((_, index) => <Cell key={`cell-${index}`} fill={performanceColors[index % performanceColors.length]} />)}
                        </Pie>
                        <Tooltip content={<AllocationTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '800', paddingTop: '30px' }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-slate-500 italic text-sm text-center px-12">{investmentsLoading ? 'Loading...' : 'Capture assets to visualize portfolio distribution.'}</div>}
                </div>
              </div>
            </div>

            {/* Price Trend Chart */}
            <PriceTrendChart currency={currentCurrency.code} currencySymbol={currentCurrency.symbol} />

            <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-slate-700/30">
              <div className="p-4 sm:p-8 border-b border-slate-700 bg-slate-800/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-base sm:text-xl font-bold flex items-center gap-2 sm:gap-3">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    Asset Ledger
                    <InfoTooltip content="Complete entry-wise history with weight, consideration, current value, and ROI. Sort columns to inspect performance." />
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">Record of all holdings and individual performance.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
                    <button
                      onClick={() => setLedgerView('active')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ledgerView === 'active' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      title="Show active holdings only"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setLedgerView('all')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ledgerView === 'all' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      title="Show all entries including sold"
                    >
                      All
                    </button>
                  </div>

                  <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3 shadow-inner">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {ledgerView === 'active' ? 'Active Records' : 'Total Records'}
                    </span>
                    <span className="text-sm font-black text-amber-500 font-mono">
                      {ledgerView === 'active' ? activeHoldings.length : investments.length}
                    </span>
                  </div>
                </div>
              </div>
              {/* Desktop Table — hidden on mobile */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 font-black border-b border-slate-800 bg-slate-800/10 tracking-widest">
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('date')} className="hover:text-slate-200 transition-colors">
                          Date{sortIndicator('date')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('asset')} className="hover:text-slate-200 transition-colors">
                          Asset{sortIndicator('asset')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('purity')} className="hover:text-slate-200 transition-colors">
                          Purity{sortIndicator('purity')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('weight')} className="hover:text-slate-200 transition-colors">
                          Weight (g){sortIndicator('weight')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('consideration')} className="hover:text-slate-200 transition-colors">
                          Consideration{sortIndicator('consideration')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('value')} className="hover:text-slate-200 transition-colors">
                          Current Value{sortIndicator('value')}
                        </button>
                      </th>
                      <th className="px-8 py-6">
                        <button onClick={() => toggleLedgerSort('roi')} className="hover:text-slate-200 transition-colors">
                          ROI (%){sortIndicator('roi')}
                        </button>
                      </th>
                      <th className="px-8 py-6 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {investmentsLoading ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-12 text-center text-slate-500 italic">Loading investments...</td>
                      </tr>
                    ) : ledgerInvestments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-12 text-center text-slate-500 italic">
                          {ledgerView === 'active'
                            ? 'No active holdings. Switch to "All" to view sold records, or add your first asset!'
                            : 'No ledger entries yet. Add your first asset!'}
                        </td>
                      </tr>
                    ) : ledgerRows.map(row => {
                      const inv = row.inv;
                      const isSold = row.isSold;
                      const isGifted = row.isGifted;
                      const realizedValue = row.displayedValue;
                      const roiPercent = row.roiPercent;
                      return (
                        <tr key={inv.id} className={`transition-colors group ${isSold || isGifted ? 'opacity-60 hover:opacity-80' : 'hover:bg-amber-500/[0.02]'}`}>
                          <td className="px-8 py-6 text-slate-400 font-medium">{formatDateWithYear(inv.dateOfPurchase)}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              {inv.metal === 'gold' ? <Sparkles className="w-3 h-3 text-amber-500" /> : <Coins className="w-3 h-3 text-slate-400" />}
                              <div className="font-bold text-slate-200 group-hover:text-amber-500 transition-colors uppercase text-xs flex items-center gap-2">
                                {inv.metal} {inv.type}
                                {isSold && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">Sold</span>}
                                {isGifted && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">Gifted</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-[10px] text-slate-500 font-black tracking-widest uppercase">{inv.purity}</td>
                          <td className="px-8 py-6 text-slate-300 font-mono font-medium">{inv.weightInGrams.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">g</span></td>
                          <td className="px-8 py-6 text-slate-200 font-semibold">{formatCurrency(inv.totalPricePaid)}</td>
                          <td className="px-8 py-6 text-amber-400 font-black">{formatCurrency(realizedValue)}</td>
                          <td className={`px-8 py-6 font-black ${roiPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{roiPercent >= 0 ? '↑' : '↓'} {Math.abs(roiPercent).toFixed(2)}%</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setEditingInvestment(inv)} className="p-2.5 hover:bg-slate-700/30 text-slate-600 hover:text-slate-200 rounded-xl transition-all" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                              {!isSold && !isGifted && (
                                <button onClick={() => setSellingInvestment(inv)} className="p-2.5 hover:bg-emerald-500/10 text-slate-600 hover:text-emerald-400 rounded-xl transition-all" title="Sell">
                                  <HandCoins className="w-4 h-4" />
                                </button>
                              )}
                              {!isSold && !isGifted && (
                                <button onClick={() => setGiftingInvestment(inv)} className="p-2.5 hover:bg-violet-500/10 text-slate-600 hover:text-violet-400 rounded-xl transition-all" title="Gift">
                                  <Gift className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => removeInvestment(inv.id)} className="p-2.5 hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 rounded-xl transition-all" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View — shown on mobile only */}
              <div className="md:hidden">
                {investmentsLoading ? (
                  <div className="px-6 py-12 text-center text-slate-500 italic">Loading investments...</div>
                ) : ledgerInvestments.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-500 italic">
                    {ledgerView === 'active'
                      ? 'No active holdings. Switch to "All" to view sold records, or add your first asset!'
                      : 'No ledger entries yet. Add your first asset!'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {ledgerRows.map(row => {
                      const inv = row.inv;
                      const isSold = row.isSold;
                      const isGifted = row.isGifted;
                      const realizedValue = row.displayedValue;
                      const roiPercent = row.roiPercent;
                      return (
                        <div key={inv.id} className={`p-4 sm:p-5 ${isSold || isGifted ? 'opacity-60' : ''}`}>
                          {/* Card Row 1: Asset name + Status + ROI */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {inv.metal === 'gold' ? <Sparkles className="w-3.5 h-3.5 text-amber-500" /> : <Coins className="w-3.5 h-3.5 text-slate-400" />}
                              <span className="font-bold text-slate-200 uppercase text-xs">{inv.metal} {inv.type}</span>
                              <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">{inv.purity}</span>
                              {isSold && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Sold</span>}
                              {isGifted && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Gifted</span>}
                            </div>
                            <span className={`text-xs font-black ${roiPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {roiPercent >= 0 ? '↑' : '↓'} {Math.abs(roiPercent).toFixed(2)}%
                            </span>
                          </div>

                          {/* Card Row 2: Key metrics in 2x2 grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Date</span>
                              <span className="text-slate-400 font-medium">{formatDateWithYear(inv.dateOfPurchase)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Weight</span>
                              <span className="text-slate-300 font-mono font-medium">{inv.weightInGrams.toFixed(2)}g</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Paid</span>
                              <span className="text-slate-200 font-semibold">{formatCurrency(inv.totalPricePaid)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{isSold ? 'Received' : isGifted ? 'Gift Value' : 'Current Val'}</span>
                              <span className="text-amber-400 font-black">{formatCurrency(realizedValue)}</span>
                            </div>
                          </div>

                          {/* Card Row 3: Action buttons */}
                          <div className="flex items-center gap-1 pt-2 border-t border-slate-800/50">
                            <button onClick={() => setEditingInvestment(inv)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all uppercase tracking-wider">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            {!isSold && !isGifted && (
                              <button onClick={() => setSellingInvestment(inv)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all uppercase tracking-wider">
                                <HandCoins className="w-3.5 h-3.5" /> Sell
                              </button>
                            )}
                            {!isSold && !isGifted && (
                              <button onClick={() => setGiftingInvestment(inv)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all uppercase tracking-wider">
                                <Gift className="w-3.5 h-3.5" /> Gift
                              </button>
                            )}
                            <button onClick={() => removeInvestment(inv.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all uppercase tracking-wider">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'insights' && (
          <AIInsights
            userId={user.id}
            currencyCode={currentCurrency.code}
            selectedMetal={selectedMetal}
            setSelectedMetal={setSelectedMetal}
          />
        )}

        {activeTab === 'advisor' && (
          <GoldAdvisor userId={user.id} currencyCode={currentCurrency.code} />
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-200">
            <InvestmentForm
              onSave={addInvestment}
              onCancel={() => setShowForm(false)}
              currentGoldPrice={liveGoldPrice?.pricePerGram || 0}
              currentSilverPrice={liveSilverPrice?.pricePerGram || 0}
              currencyCode={currentCurrency.code}
              currencySymbol={currentCurrency.symbol}
            />
          </div>
        </div>
      )}

      {editingInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-200">
            <InvestmentForm
              mode="edit"
              initialInvestment={editingInvestment}
              onSave={updateInvestment}
              onCancel={() => setEditingInvestment(null)}
              currentGoldPrice={liveGoldPrice?.pricePerGram || 0}
              currentSilverPrice={liveSilverPrice?.pricePerGram || 0}
              currencyCode={currentCurrency.code}
              currencySymbol={currentCurrency.symbol}
            />
          </div>
        </div>
      )}

      {sellingInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-200">
            <SellInvestmentForm
              investment={sellingInvestment}
              currencySymbol={currentCurrency.symbol}
              onCancel={() => setSellingInvestment(null)}
              onConfirm={(sale) => markInvestmentSold(sellingInvestment.id, sale)}
            />
          </div>
        </div>
      )}

      {giftingInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-200">
            <GiftInvestmentForm
              investment={giftingInvestment}
              currencySymbol={currentCurrency.symbol}
              defaultMarketValue={(() => {
                const goldPriceToUse = (liveGoldPrice?.quotes && liveGoldPrice.quotes.length > selectedGoldSourceIndex)
                  ? liveGoldPrice.quotes[selectedGoldSourceIndex].price
                  : (liveGoldPrice?.pricePerGram || 0);

                const silverPriceToUse = (liveSilverPrice?.quotes && liveSilverPrice.quotes.length > selectedSilverSourceIndex)
                  ? liveSilverPrice.quotes[selectedSilverSourceIndex].price
                  : (liveSilverPrice?.pricePerGram || 0);

                const base = giftingInvestment.metal === 'gold' ? goldPriceToUse : silverPriceToUse;
                const curUnit = (base || 0) * PURITY_MULTIPLIERS[giftingInvestment.purity];
                return curUnit * giftingInvestment.weightInGrams;
              })()}
              onCancel={() => setGiftingInvestment(null)}
              onConfirm={(gift) => markInvestmentGifted(giftingInvestment.id, gift)}
            />
          </div>
        </div>
      )}

      {showProfile && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-200"><ProfileSettings user={user} onSave={handleProfileUpdate} onCancel={() => setShowProfile(false)} /></div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; subtitle?: string; icon: React.ReactNode; isPositive?: boolean; infoText?: string }> = ({ title, value, subtitle, icon, isPositive, infoText }) => (
  <div className="glass-card p-4 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col justify-between h-28 sm:h-40 border-b-4 border-b-transparent hover:border-b-amber-500/50 transition-all duration-300 group shadow-lg">
    <div className="flex justify-between items-start">
      <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight flex items-center gap-1.5">
        {title}
        {infoText && <InfoTooltip content={infoText} />}
      </span>
      <div className="p-1.5 sm:p-3 bg-slate-800/80 rounded-xl sm:rounded-2xl group-hover:bg-amber-500/10 group-hover:scale-110 transition-all border border-slate-700/50 shadow-inner">{icon}</div>
    </div>
    <div className="mt-2 sm:mt-4"><div className="text-base sm:text-2xl font-black tracking-tight group-hover:gold-text transition-colors duration-300 truncate">{value}</div>
      {subtitle && <div className="flex items-center gap-1 sm:gap-1.5 mt-1 sm:mt-2"><div className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md flex items-center gap-1 ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{subtitle} Growth</div></div>}
    </div>
  </div>
);

export default App;
