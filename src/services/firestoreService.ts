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
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Investment } from '../../types';

// Collection reference
const INVESTMENTS_COLLECTION = 'investments';

/**
 * Add a new investment
 */
export const addInvestment = async (
    investment: Omit<Investment, 'id'>
): Promise<Investment> => {
    const docRef = await addDoc(collection(db, INVESTMENTS_COLLECTION), {
        ...investment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

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
            purchasePricePerGram: data.purchasePricePerGram
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
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
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
