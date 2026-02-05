# GoldTrack - Firebase Implementation Guide

## ✅ Implementation Complete

The following Firebase features have been integrated into the GoldTrack application:

### 1. Authentication
- **Email/Password Sign Up** - Creates user in Firebase Auth + Firestore
- **Email/Password Sign In** - Authenticates against Firebase Auth
- **Google Sign In** - OAuth with Google, creates/retrieves user from Firestore
- **Password Reset** - Sends reset email via Firebase
- **Session Management** - Uses `onAuthStateChanged` for persistent sessions

### 2. Database (Firestore)
- **Users Collection** - Stores user profile data (name, email, country, currency)
- **Investments Collection** - Stores gold/silver investment records

### 3. Security Rules
- Users can only read/write their own documents
- Investment records are scoped to the owning user

---

## 🔧 Setup Instructions

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or have your infra team create one)
3. Enable **Authentication** with Email/Password and Google Sign-in
4. Enable **Firestore Database** (create in production mode)

### Step 2: Get Firebase Config
From Firebase Console → Project Settings → General → Your apps → Web app:
```
apiKey: "xxx"
authDomain: "xxx.firebaseapp.com"
projectId: "xxx"
storageBucket: "xxx.appspot.com"
messagingSenderId: "xxx"
appId: "xxx"
```

### Step 3: Update Environment Variables
Edit `.env.local` and replace placeholders:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Step 4: Deploy Firestore Security Rules
```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```

### Step 5: Create Firestore Index (Required)
In Firebase Console → Firestore → Indexes, create a composite index:
- Collection: `investments`
- Fields:
  - `userId` (Ascending)
  - `dateOfPurchase` (Descending)

Or deploy using CLI with indexes file.

### Step 6: Run Locally
```bash
npm install
npm run dev
```

### Step 7: Build & Deploy
```bash
npm run build
firebase deploy --only hosting
```

---

## 📁 File Structure

```
GoldTrack/
├── src/
│   ├── firebase.ts              # Firebase initialization
│   ├── services/
│   │   ├── authService.ts       # Authentication operations
│   │   └── firestoreService.ts  # Database operations
│   └── vite-env.d.ts            # TypeScript environment types
├── components/
│   ├── Auth.tsx                 # Login/Signup (uses Firebase)
│   ├── ProfileSettings.tsx      # Profile (uses Firebase)
│   └── ...
├── services/
│   └── geminiService.ts         # AI features (Gemini API)
├── firestore.rules              # Security rules
├── firebase.json                # Hosting config
├── .firebaserc                  # Project config
└── .env.local                   # Environment variables
```

---

## 🔒 Security Notes

1. **Environment Variables**: Never commit `.env.local` to git
2. **Security Rules**: Always deploy rules before going live
3. **Google Sign-in**: Add your domain to authorized domains in Firebase Console

---

## 🧪 Testing Checklist

- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google
- [ ] Password reset email received
- [ ] Add new investment (saved to Firestore)
- [ ] Delete investment
- [ ] Update profile settings
- [ ] Change password
- [ ] Data persists after logout/login
- [ ] Different users see only their own data

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firebase config in `.env.local`
3. Ensure Firestore indexes are created
4. Verify security rules are deployed
