/**
 * Firestore Service
 * Handles all database operations for investments
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { Investment, MetalPriceData } from '../types';

/**
 * Firestore does NOT accept `undefined` values.
 * Strip them before writes to avoid "Unsupported field value: undefined" errors.
 */
const stripUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        out[k] = v;
    }
    return out as Partial<T>;
};

// Collection reference
const INVESTMENTS_COLLECTION = 'investments';

/**
 * Add a new investment
 */
export const addInvestment = async (
    investment: Omit<Investment, 'id'>
): Promise<Investment> => {
    const payload = stripUndefined({
        ...investment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    const docRef = await addDoc(collection(db, INVESTMENTS_COLLECTION), payload);

    return {
        ...investment,
        id: docRef.id
    } as Investment;
};

/**
 * Get all investments for a user
 */
export const getInvestmentsByUserId = async (
    userId: string
): Promise<Investment[]> => {
    const q = query(
        collection(db, INVESTMENTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('dateOfPurchase', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const investments: Investment[] = [];

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        investments.push({
            id: doc.id,
            userId: data.userId,
            metal: data.metal,
            purity: data.purity,
            type: data.type,
            dateOfPurchase: data.dateOfPurchase,
            weightInGrams: data.weightInGrams,
            totalPricePaid: data.totalPricePaid,
            purchasePricePerGram: data.purchasePricePerGram,
            units: data.units,
            navPerUnit: data.navPerUnit,
            purchasePricePerUnit: data.purchasePricePerUnit,
            status: data.status || 'HOLD',
            soldAt: data.soldAt,
            salePricePerGram: data.salePricePerGram,
            saleTotalReceived: data.saleTotalReceived,
            giftedAt: data.giftedAt,
            giftedMarketValue: data.giftedMarketValue,
            giftedNotes: data.giftedNotes
        });
    });

    return investments;
};

/**
 * Update an investment
 */
export const updateInvestment = async (
    investmentId: string,
    updates: Partial<Investment>
): Promise<void> => {
    const docRef = doc(db, INVESTMENTS_COLLECTION, investmentId);
    const payload = stripUndefined({
        ...updates,
        updatedAt: serverTimestamp()
    });
    await updateDoc(docRef, payload);
};

/**
 * Delete an investment
 */
export const deleteInvestment = async (investmentId: string): Promise<void> => {
    const docRef = doc(db, INVESTMENTS_COLLECTION, investmentId);
    await deleteDoc(docRef);
};

/**
 * Delete all investments for a user (useful for account deletion)
 */
export const deleteAllUserInvestments = async (userId: string): Promise<void> => {
    const q = query(
        collection(db, INVESTMENTS_COLLECTION),
        where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
};
// Collection reference for prices
const PRICES_COLLECTION = 'prices';

/**
 * Save metal prices to Firestore
 */
export const saveMetalPrices = async (prices: MetalPriceData[]): Promise<void> => {
    for (const price of prices) {
        const docRef = doc(db, PRICES_COLLECTION, `${price.metal}_${price.currency}`);
        await setDoc(docRef, {
            ...price,
            updatedAt: serverTimestamp()
        });
    }
};

/**
 * Get latest metal prices from Firestore
 */
export const getLatestMetalPrices = async (currency: string): Promise<MetalPriceData[]> => {
    try {
        const metals = ['gold', 'silver'];
        const prices: MetalPriceData[] = [];

        for (const metal of metals) {
            const docRef = doc(db, PRICES_COLLECTION, `${metal}_${currency}`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Ensure quotes is an array if it exists, roughly validating the shape
                const quotes = Array.isArray(data.quotes) ? data.quotes : [];
                prices.push({
                    metal: data.metal,
                    pricePerGram: data.pricePerGram,
                    lastUpdated: data.lastUpdated,
                    currency: data.currency,
                    sources: data.sources || [],
                    quotes: quotes
                } as MetalPriceData);
            }
        }
        return prices;
    } catch (error) {
        console.error("Error fetching prices from DB:", error);
        return [];
    }
};

// Collection for Advisor Data
const ADVISOR_COLLECTION = 'advisor_data';

export interface AdvisorDataCache {
    price: number;
    dma50: number;
    dma200: number;
    lastUpdated: string;
    currency: string;
}

export const saveAdvisorData = async (data: AdvisorDataCache): Promise<void> => {
    const docRef = doc(db, ADVISOR_COLLECTION, `gold_${data.currency}`);
    await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
};

// Cache expiry constant (24 hours in milliseconds) - daily refresh semantics
const ADVISOR_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const getLatestAdvisorData = async (currency: string): Promise<AdvisorDataCache | null> => {
    try {
        const docRef = doc(db, ADVISOR_COLLECTION, `gold_${currency}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as AdvisorDataCache;

            // Check if cache has expired (4 hours)
            if (data.lastUpdated) {
                const lastUpdatedTime = new Date(data.lastUpdated).getTime();
                const now = Date.now();

                if (now - lastUpdatedTime > ADVISOR_CACHE_EXPIRY_MS) {
                    console.log('Advisor cache expired (>4 hours), fetching fresh data...');
                    return null; // Cache expired, will trigger fresh fetch
                }
            }

            return data;
        }
        return null;
    } catch (error) {
        console.error("Error fetching advisor data:", error);
        return null;
    }
};

// ==========================================
// PRICE HISTORY - For Trend Charts
// ==========================================
const PRICE_HISTORY_COLLECTION = 'price_history';

export interface PriceHistoryPoint {
    id?: string;
    metal: 'gold' | 'silver';
    currency: string;
    pricePerGram: number;
    timestamp: string; // ISO string
    sourceName?: string;
}

/**
 * Save a price point to history (for trend tracking)
 * This appends to history, unlike saveMetalPrices which overwrites
 */
export const savePriceToHistory = async (
    metal: 'gold' | 'silver',
    currency: string,
    pricePerGram: number,
    sourceName?: string
): Promise<void> => {
    try {
        await addDoc(collection(db, PRICE_HISTORY_COLLECTION), {
            metal,
            currency,
            pricePerGram,
            sourceName: sourceName || 'Market Average',
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving price to history:", error);
    }
};

/**
 * Get price history for a metal/currency pair
 * @param metal - 'gold' or 'silver'
 * @param currency - e.g., 'INR'
 * @param days - Number of days of history to fetch (default 30)
 */
export const getPriceHistory = async (
    metal: 'gold' | 'silver',
    currency: string,
    days: number = 30
): Promise<PriceHistoryPoint[]> => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        // Use start-of-day UTC to avoid dropping the boundary day due to time-of-day comparisons
        const cutoffISO = `${cutoffDate.toISOString().split('T')[0]}T00:00:00.000Z`;

        const q = query(
            collection(db, PRICE_HISTORY_COLLECTION),
            where('metal', '==', metal),
            where('currency', '==', currency),
            where('timestamp', '>=', cutoffISO),
            orderBy('timestamp', 'asc')
        );

        const querySnapshot = await getDocs(q);
        const history: PriceHistoryPoint[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            history.push({
                id: doc.id,
                metal: data.metal,
                currency: data.currency,
                pricePerGram: data.pricePerGram,
                timestamp: data.timestamp,
                sourceName: data.sourceName
            });
        });

        return history;
    } catch (error) {
        console.error("Error fetching price history:", error);
        return [];
    }
};
