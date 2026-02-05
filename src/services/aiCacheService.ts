/**
 * AI Cache Service
 * Stores and retrieves AI analysis data from Firestore to save tokens
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { MetalNarrative, DailyPricePoint, MetalType } from '../../types';

// Collection name for AI cache
const AI_CACHE_COLLECTION = 'aiCache';

// Cache expiration time (in hours) - data older than this will be refreshed
const CACHE_EXPIRATION_HOURS = 4;

// Types for cached data
export interface CachedDailySeries {
    metal: MetalType;
    currency: string;
    data: DailyPricePoint[];
    lastUpdated: string;
    createdAt?: Timestamp;
}

export interface CachedNarrative {
    metal: MetalType;
    data: MetalNarrative;
    lastUpdated: string;
    createdAt?: Timestamp;
}

export interface CachedAdvisorData {
    currency: string;
    price: number;
    dma50: number;
    dma200: number;
    lastUpdated: string;
    createdAt?: Timestamp;
}

/**
 * Check if cached data is still valid (not expired)
 */
const isCacheValid = (lastUpdated: string): boolean => {
    const cacheTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
    return hoursDiff < CACHE_EXPIRATION_HOURS;
};

/**
 * Get cache document ID for daily series
 */
const getDailySeriesDocId = (userId: string, metal: MetalType, currency: string) =>
    `dailySeries_${userId}_${metal}_${currency}`;

/**
 * Get cache document ID for narrative
 */
const getNarrativeDocId = (userId: string, metal: MetalType) =>
    `narrative_${userId}_${metal}`;

/**
 * Get cache document ID for advisor data
 */
const getAdvisorDocId = (userId: string, currency: string) =>
    `advisor_${userId}_${currency}`;

// =========== Daily Series Cache ===========

/**
 * Get cached daily series from Firestore
 */
export const getCachedDailySeries = async (
    userId: string,
    metal: MetalType,
    currency: string
): Promise<CachedDailySeries | null> => {
    try {
        const docId = getDailySeriesDocId(userId, metal, currency);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as CachedDailySeries;
            if (isCacheValid(data.lastUpdated)) {
                return data;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting cached daily series:', error);
        return null;
    }
};

/**
 * Save daily series to Firestore cache
 */
export const saveDailySeriesCache = async (
    userId: string,
    metal: MetalType,
    currency: string,
    data: DailyPricePoint[]
): Promise<void> => {
    try {
        const docId = getDailySeriesDocId(userId, metal, currency);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);

        await setDoc(docRef, {
            userId,
            metal,
            currency,
            data,
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving daily series cache:', error);
    }
};

// =========== Narrative Cache ===========

/**
 * Get cached narrative from Firestore
 */
export const getCachedNarrative = async (
    userId: string,
    metal: MetalType
): Promise<CachedNarrative | null> => {
    try {
        const docId = getNarrativeDocId(userId, metal);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cached = docSnap.data() as CachedNarrative;
            if (isCacheValid(cached.lastUpdated)) {
                return cached;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting cached narrative:', error);
        return null;
    }
};

/**
 * Save narrative to Firestore cache
 */
export const saveNarrativeCache = async (
    userId: string,
    metal: MetalType,
    data: MetalNarrative
): Promise<void> => {
    try {
        const docId = getNarrativeDocId(userId, metal);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);

        await setDoc(docRef, {
            userId,
            metal,
            data,
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving narrative cache:', error);
    }
};

// =========== Advisor Data Cache ===========

/**
 * Get cached advisor data from Firestore
 */
export const getCachedAdvisorData = async (
    userId: string,
    currency: string
): Promise<CachedAdvisorData | null> => {
    try {
        const docId = getAdvisorDocId(userId, currency);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cached = docSnap.data() as CachedAdvisorData;
            if (isCacheValid(cached.lastUpdated)) {
                return cached;
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting cached advisor data:', error);
        return null;
    }
};

/**
 * Save advisor data to Firestore cache
 */
export const saveAdvisorDataCache = async (
    userId: string,
    currency: string,
    price: number,
    dma50: number,
    dma200: number
): Promise<void> => {
    try {
        const docId = getAdvisorDocId(userId, currency);
        const docRef = doc(db, AI_CACHE_COLLECTION, docId);

        await setDoc(docRef, {
            userId,
            currency,
            price,
            dma50,
            dma200,
            lastUpdated: new Date().toISOString(),
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving advisor data cache:', error);
    }
};
