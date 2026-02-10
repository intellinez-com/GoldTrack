/**
 * Historical Price Service - Using Metals.dev API
 * 
 * Strategy:
 * - Historical data is STATIC (past prices never change)
 * - Fetch historical data ONCE and store in Firestore
 * - Only fetch TODAY's price for daily updates (~30 calls/month)
 * - Well within the free 100 requests/month limit
 */

import { db } from '../src/firebase';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'firebase/firestore';
import { DailyPricePoint } from '../types';

const HISTORICAL_DATA_COLLECTION = 'historical_prices';

// Metals.dev API configuration
const API_BASE_URL = 'https://api.metals.dev/v1';

// Troy ounce to gram conversion
const TROY_OZ_TO_GRAM = 31.1035;

interface MetalsDevLatestResponse {
    status: string;
    currency: string;
    unit: string;
    metals: {
        gold?: number;
        silver?: number;
        platinum?: number;
        palladium?: number;
    };
    timestamps?: {
        metal: string;
        ask: string;
        bid: string;
        lmeFix: string;
        lbmaAMFix: string;
        lbmaPMFix: string;
    };
}

interface MetalsDevTimeseriesResponse {
    status: string;
    start_date: string;
    end_date: string;
    currency: string;
    unit: string;
    rates: {
        [date: string]: {
            date: string;
            metals: {
                gold?: number;
                silver?: number;
                platinum?: number;
                palladium?: number;
            };
            currencies?: Record<string, number>;
        };
    };
}

interface CachedHistoricalData {
    metal: 'gold' | 'silver';
    currency: string;
    data: DailyPricePoint[];
    lastSeededAt: string;  // When historical seed was done
    lastUpdatedAt: string; // When daily price was added
    dataStartDate: string;
    dataEndDate: string;
}

/**
 * Get the API key from environment
 */
const getApiKey = (): string | null => {
    return import.meta.env.VITE_METALS_API_KEY || null;
};

/**
 * Fetch LATEST price from metals.dev
 * Used for daily updates - 1 call per day
 */
export const fetchLatestPrice = async (
    metal: 'gold' | 'silver',
    currency: string
): Promise<{ price: number; date: string } | null> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('VITE_METALS_API_KEY not set in environment');
        return null;
    }

    try {
        const url = `${API_BASE_URL}/latest?api_key=${apiKey}&currency=${currency}&unit=g`;
        console.log('Fetching latest price...');

        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`API error: ${response.status}`);
        }

        const data: MetalsDevLatestResponse = await response.json();

        if (data.status !== 'success') {
            throw new Error(`API returned status: ${data.status}`);
        }

        const price = data.metals[metal];
        if (!price) {
            throw new Error(`No ${metal} price in response`);
        }

        return {
            price: parseFloat(price.toFixed(2)),
            date: new Date().toISOString().split('T')[0]
        };
    } catch (error) {
        console.error('Error fetching latest price:', error);
        return null;
    }
};

/**
 * Fetch HISTORICAL timeseries from metals.dev
 * This is called ONCE to seed the data - then stored forever
 * NOTE: API limits to 30 days per request, so we fetch in chunks
 */
export const fetchHistoricalTimeseries = async (
    metal: 'gold' | 'silver',
    currency: string,
    days: number = 250
): Promise<DailyPricePoint[]> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('VITE_METALS_API_KEY not set in environment');
        return [];
    }

    try {
        const allPricePoints: DailyPricePoint[] = [];
        const MAX_DAYS_PER_REQUEST = 30;

        // Calculate how many chunks we need
        const today = new Date();
        today.setDate(today.getDate() - 1); // Start from yesterday (API requirement)

        let currentEndDate = new Date(today);
        let remainingDays = days;

        console.log(`Fetching ${days} days of historical data in ${Math.ceil(days / MAX_DAYS_PER_REQUEST)} chunks...`);

        while (remainingDays > 0) {
            const chunkDays = Math.min(remainingDays, MAX_DAYS_PER_REQUEST);

            const endDate = new Date(currentEndDate);
            const startDate = new Date(currentEndDate);
            startDate.setDate(startDate.getDate() - chunkDays + 1);

            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            const url = `${API_BASE_URL}/timeseries?api_key=${apiKey}&start_date=${startStr}&end_date=${endStr}&base=${currency}&metals=${metal}`;
            console.log(`Fetching chunk: ${startStr} to ${endStr} (${chunkDays} days)`);

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            const data: MetalsDevTimeseriesResponse = await response.json();

            // Debug: Log the API response structure
            console.log('API Response:', JSON.stringify(data).substring(0, 500));

            if (data.status !== 'success' || !data.rates) {
                throw new Error(`API returned status: ${data.status}`);
            }

            // Debug: Log first rate entry to see structure
            const rateEntries = Object.entries(data.rates);
            if (rateEntries.length > 0) {
                console.log('Sample rate entry:', rateEntries[0]);
            } else {
                console.log('No rate entries in response!');
            }

            // Extract price points from this chunk
            // API returns prices in USD per troy ounce
            // We need to convert to target currency per gram
            for (const [dateStr, rateData] of Object.entries(data.rates)) {
                const metalPriceUSD = rateData.metals?.[metal];
                const currencyRate = rateData.currencies?.[currency];

                if (metalPriceUSD && metalPriceUSD > 0) {
                    // Convert from troy ounce to gram (1 toz = 31.1035 grams)
                    let pricePerGram = metalPriceUSD / TROY_OZ_TO_GRAM;

                    // Convert to target currency if not USD
                    if (currency !== 'USD' && currencyRate && currencyRate > 0) {
                        // API returns rates as USD/currency, so we divide
                        pricePerGram = pricePerGram / currencyRate;
                    }

                    allPricePoints.push({
                        date: dateStr,
                        price: parseFloat(pricePerGram.toFixed(2))
                    });
                }
            }

            // Move to the next chunk
            remainingDays -= chunkDays;
            currentEndDate.setDate(currentEndDate.getDate() - chunkDays);

            // Small delay to avoid rate limiting
            if (remainingDays > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Sort by date and remove duplicates
        const uniquePoints = new Map<string, DailyPricePoint>();
        for (const point of allPricePoints) {
            uniquePoints.set(point.date, point);
        }

        const sortedPoints = Array.from(uniquePoints.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log(`Fetched ${sortedPoints.length} historical data points for ${metal}`);
        return sortedPoints;
    } catch (error) {
        console.error('Error fetching historical timeseries:', error);
        return [];
    }
};

/**
 * Get cached historical data from Firestore
 */
export const getCachedHistoricalData = async (
    metal: 'gold' | 'silver',
    currency: string
): Promise<CachedHistoricalData | null> => {
    try {
        const docId = `${metal}_${currency}`;
        const docRef = doc(db, HISTORICAL_DATA_COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as CachedHistoricalData;
        }
        return null;
    } catch (error) {
        console.error('Error fetching cached historical data:', error);
        return null;
    }
};

/**
 * Save historical data to Firestore
 */
export const saveHistoricalData = async (
    metal: 'gold' | 'silver',
    currency: string,
    data: DailyPricePoint[],
    isInitialSeed: boolean = false
): Promise<void> => {
    try {
        if (data.length === 0) return;

        const docId = `${metal}_${currency}`;
        const sortedData = [...data].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const now = new Date().toISOString();

        const cacheDoc: CachedHistoricalData = {
            metal,
            currency,
            data: sortedData,
            lastSeededAt: isInitialSeed ? now : (await getCachedHistoricalData(metal, currency))?.lastSeededAt || now,
            lastUpdatedAt: now,
            dataStartDate: sortedData[0].date,
            dataEndDate: sortedData[sortedData.length - 1].date
        };

        await setDoc(doc(db, HISTORICAL_DATA_COLLECTION, docId), cacheDoc);
        console.log(`Saved ${data.length} historical data points for ${metal}/${currency}`);
    } catch (error) {
        console.error('Error saving historical data:', error);
    }
};

/**
 * Check if we need to add today's price to historical data
 */
const needsDailyUpdate = (cached: CachedHistoricalData): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const lastUpdateDate = cached.lastUpdatedAt.split('T')[0];

    // Update if last update was not today
    return lastUpdateDate !== today;
};

/**
 * Check if there's a significant data gap that requires a reseed
 * Returns true if the gap between cached data end and today is > 3 days
 */
const hasDataGap = (cached: CachedHistoricalData): boolean => {
    if (!cached.dataEndDate) return true;

    const today = new Date();
    const lastDataDate = new Date(cached.dataEndDate);
    const diffDays = Math.floor((today.getTime() - lastDataDate.getTime()) / (1000 * 60 * 60 * 24));

    // If gap is more than 3 days, we need to reseed to fill missing data
    if (diffDays > 3) {
        console.log(`Data gap detected: ${diffDays} days since ${cached.dataEndDate}`);
        return true;
    }
    return false;
};

/**
 * Check if historical data has been seeded
 */
const isSeeded = (cached: CachedHistoricalData | null): boolean => {
    return cached !== null && cached.data.length >= 100;
};

/**
 * MAIN FUNCTION: Get historical price data
 * 
 * Logic:
 * 1. Check Firestore cache
 * 2. If no data or force refresh → Seed historical data (250 days)
 * 3. If data exists but needs daily update → Add today's price
 * 4. Return the complete dataset
 */
export const getHistoricalPriceData = async (
    metal: 'gold' | 'silver',
    currency: string,
    days: number = 250,
    forceRefresh: boolean = false
): Promise<DailyPricePoint[]> => {
    // 1. Check cache first
    const cached = await getCachedHistoricalData(metal, currency);
    console.log('Cached data:', cached);
    // 2. If force refresh, not seeded, data gap, or requested range exceeds cache → Full historical fetch
    const cacheTooShort = !!cached && cached.data && cached.data.length < Math.floor(days * 0.9);
    const needsReseed = forceRefresh || !isSeeded(cached) || (cached && hasDataGap(cached)) || cacheTooShort;
    console.log('Needs reseed:', needsReseed);
    if (needsReseed) {
        const reason = forceRefresh
            ? 'force refresh'
            : !isSeeded(cached)
                ? 'not seeded'
                : cacheTooShort
                    ? 'requested range exceeds cache'
                    : 'data gap';
        console.log(`Seeding historical data for ${metal}/${currency} (reason: ${reason})...`);

        const historicalData = await fetchHistoricalTimeseries(metal, currency, days);

        if (historicalData.length > 0) {
            // Add today's price if not in the data
            const today = new Date().toISOString().split('T')[0];
            const hasToday = historicalData.some(d => d.date === today);

            if (!hasToday) {
                const latestPrice = await fetchLatestPrice(metal, currency);
                if (latestPrice) {
                    historicalData.push(latestPrice);
                }
            }

            await saveHistoricalData(metal, currency, historicalData, true);
            return historicalData;
        }

        // If API failed, return whatever we have in cache
        return cached?.data || [];
    }

    // 3. We have seeded data - check if needs daily update
    if (needsDailyUpdate(cached!)) {
        console.log(`Adding daily update for ${metal}/${currency}...`);

        const latestPrice = await fetchLatestPrice(metal, currency);

        if (latestPrice) {
            // Add to existing data
            const updatedData = [...cached!.data];

            // Remove old entry for today if exists
            const todayIndex = updatedData.findIndex(d => d.date === latestPrice.date);
            if (todayIndex >= 0) {
                updatedData[todayIndex] = latestPrice;
            } else {
                updatedData.push(latestPrice);
            }

            // Keep only last 'days' worth of data
            const sortedData = updatedData
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(-days);

            await saveHistoricalData(metal, currency, sortedData, false);
            return sortedData;
        }
    }

    // 4. Return cached data as-is
    console.log(`Using cached historical data for ${metal}/${currency} (${cached!.data.length} points)`);
    return cached!.data;
};

/**
 * Seed historical data for all metals and currencies
 * Call this ONCE to populate the database
 */
export const seedAllHistoricalData = async (currencies: string[] = ['INR', 'USD']): Promise<void> => {
    console.log('Starting historical data seed...');

    for (const currency of currencies) {
        for (const metal of ['gold', 'silver'] as const) {
            console.log(`Seeding ${metal}/${currency}...`);
            await getHistoricalPriceData(metal, currency, 250, true);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('Historical data seed complete!');
};

/**
 * Backfill price_history collection for dashboard charts
 * This fetches historical data from Metals.dev API and populates the price_history collection
 * Call this ONCE to populate chart data
 */
export const backfillPriceHistory = async (
    currency: string,
    days: number = 90
): Promise<{ success: boolean; goldCount: number; silverCount: number }> => {
    const { addDoc, collection, query, where, getDocs, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('../src/firebase');

    console.log(`Starting price history backfill for ${currency} (${days} days)...`);

    let goldCount = 0;
    let silverCount = 0;

    try {
        // Fetch historical data for both metals
        for (const metal of ['gold', 'silver'] as const) {
            console.log(`Fetching ${metal} historical data...`);

            // Get historical data from Metals.dev API (uses cache if available)
            const historicalData = await getHistoricalPriceData(metal, currency, days, false);

            if (historicalData.length === 0) {
                console.warn(`No historical data available for ${metal}/${currency}`);
                continue;
            }

            console.log(`Got ${historicalData.length} data points for ${metal}`);

            // Check what dates already exist in price_history to avoid duplicates
            const existingDates = new Set<string>();
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                const cutoffISO = cutoffDate.toISOString();

                const q = query(
                    collection(db, 'price_history'),
                    where('metal', '==', metal),
                    where('currency', '==', currency),
                    where('timestamp', '>=', cutoffISO)
                );

                const existingDocs = await getDocs(q);
                existingDocs.forEach(doc => {
                    const data = doc.data();
                    if (data.timestamp) {
                        // Extract date part only for comparison
                        const dateKey = data.timestamp.split('T')[0];
                        existingDates.add(dateKey);
                    }
                });
                console.log(`Found ${existingDates.size} existing entries for ${metal}/${currency}`);
            } catch (error) {
                console.log('Could not check existing data (might be first run):', error);
            }

            // Insert historical data points that don't already exist
            for (const point of historicalData) {
                const dateKey = point.date; // Already in YYYY-MM-DD format

                if (existingDates.has(dateKey)) {
                    continue; // Skip if already exists
                }

                try {
                    await addDoc(collection(db, 'price_history'), {
                        metal,
                        currency,
                        pricePerGram: point.price,
                        sourceName: 'Metals.dev API (Backfill)',
                        timestamp: `${point.date}T12:00:00.000Z`, // Set to noon for consistency
                        createdAt: serverTimestamp(),
                        isBackfilled: true // Mark as backfilled data
                    });

                    if (metal === 'gold') goldCount++;
                    else silverCount++;
                } catch (error) {
                    console.error(`Error inserting ${metal} price for ${point.date}:`, error);
                }
            }

            console.log(`Backfilled ${metal === 'gold' ? goldCount : silverCount} new entries for ${metal}`);

            // Small delay between metals to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`Backfill complete! Gold: ${goldCount}, Silver: ${silverCount} new entries`);
        return { success: true, goldCount, silverCount };

    } catch (error) {
        console.error('Error during backfill:', error);
        return { success: false, goldCount, silverCount };
    }
};
