# GoldTrack Analytics 📈

**GoldTrack Analytics** is a premium wealth management and portfolio tracking application specialized for precious metals (Gold & Silver). It leverages **Google's Gemini AI** to provide real-time market insights, intelligent advisor signals, and automated valuations.

<div align="center">
  <img src="public/favicon.png" alt="GoldTrack Logo" width="100" />
</div>

## 🚀 Features

### 💼 Portfolio Management
*   **Track Investments**: Log your gold and silver purchases with details like purity (18K, 22K, 24K), weight, and purchase date.
*   **Real-time Valuation**: Instantly see your portfolio's current market value based on live prices.
*   **Performance Metrics**: View Net P/L, total invested, and gain percentages.

### 🤖 AI-Powered Intelligence (Gemini 2.0)
*   **AI Insights**: Get qualitative market analysis, expert outlook signatures (Bullish/Bearish), and geopolitical impact summaries.
*   **Gold Advisor**: Techncial analysis powered by AI that calculates 50-day and 200-day Moving Averages to give "Buy", "Sell", or "Hold" signals.
*   **Smart Caching**: AI analysis is cached in Firestore for 4 hours to optimize token usage and ensuring instant loading.

### 📊 Market Data
*   **Live Prices**: Real-time fetching of gold and silver prices via Gemini Search Grounding.
*   **Interactive Charts**: 7D, 30D, 1Y, and 5Y historical price charts data.
*   **Currency Support**: View portfolio in INR, USD, EUR, GBP, AED, etc.

### 🔒 Security & Compliance
*   **Secure Auth**: Firebase Authentication (Email/Password & Google Sign-in).
*   **Data Privacy**: Firestore security rules ensure strict user data isolation.
*   **Compliance**: Dedicated Financial Compliance & Risk Disclosure policies.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript, Tailwind CSS
*   **AI**: Google Gemini API (Visual & Text models)
*   **Backend/DB**: Firebase (Auth, Firestore, Hosting)
*   **Charts**: Recharts
*   **Icons**: Lucide React

---

## ⚡ Setup & Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/goldtrack.git
    cd goldtrack
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env.local` file in the root directory:
    ```env
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_GEMINI_MODEL=gemini-2.5-flash-lite
    ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```

## 📦 Deployment

The app is configured for **Firebase Hosting**.

1.  **Build**
    ```bash
    npm run build
    ```

2.  **Deploy**
    ```bash
    firebase deploy --only hosting
    ```

## 📄 License
Private & Confidential.
