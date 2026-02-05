/**
 * Firebase Authentication Service
 * Handles all authentication operations
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    User as FirebaseUser,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { User } from '../../types';

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (
    email: string,
    password: string,
    name: string
): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Update Firebase Auth profile
    await updateProfile(firebaseUser, {
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    });

    // Create user document in Firestore
    const userData: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        country: 'IN',
        currency: 'INR'
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return userData;
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
    email: string,
    password: string
): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Fetch user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    if (userDoc.exists()) {
        const data = userDoc.data();
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: data.name || firebaseUser.displayName || '',
            avatar: data.avatar || firebaseUser.photoURL || '',
            country: data.country,
            currency: data.currency
        };
    }

    // Fallback if Firestore doc doesn't exist
    return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || '',
        avatar: firebaseUser.photoURL || ''
    };
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<User> => {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    // Check if user already exists in Firestore
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        // Return existing user data
        const data = userDoc.data();
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: data.name || firebaseUser.displayName || '',
            avatar: data.avatar || firebaseUser.photoURL || '',
            country: data.country,
            currency: data.currency
        };
    }

    // Create new user document for first-time Google sign-in
    const userData: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || '',
        avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.email}`,
        country: 'IN',
        currency: 'INR'
    };

    await setDoc(userDocRef, {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return userData;
};

/**
 * Sign out the current user
 */
export const logOut = async (): Promise<void> => {
    await signOut(auth);
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

/**
 * Update user profile in Firestore
 */
export const updateUserProfile = async (
    userId: string,
    updates: Partial<User>
): Promise<User> => {
    const userDocRef = doc(db, 'users', userId);

    await setDoc(userDocRef, {
        ...updates,
        updatedAt: serverTimestamp()
    }, { merge: true });

    // Fetch and return updated user data
    const updatedDoc = await getDoc(userDocRef);
    const data = updatedDoc.data();

    return {
        id: userId,
        email: data?.email || '',
        name: data?.name || '',
        avatar: data?.avatar || '',
        country: data?.country,
        currency: data?.currency
    };
};

/**
 * Get current user data from Firestore
 */
export const getCurrentUserData = async (userId: string): Promise<User | null> => {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (userDoc.exists()) {
        const data = userDoc.data();
        return {
            id: userId,
            email: data.email || '',
            name: data.name || '',
            avatar: data.avatar || '',
            country: data.country,
            currency: data.currency
        };
    }

    return null;
};

/**
 * Subscribe to auth state changes
 */
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Get current Firebase user
 */
export const getCurrentFirebaseUser = (): FirebaseUser | null => {
    return auth.currentUser;
};
