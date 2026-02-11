import React from 'react';
import { TrendingUp, ArrowLeft, Shield, AlertTriangle, Brain, Database, Users, CheckCircle2 } from 'lucide-react';

interface CompliancePageProps {
    onClose?: () => void;
}

const CompliancePage: React.FC<CompliancePageProps> = ({ onClose }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const handleReturn = () => {
        if (onClose) {
            onClose();
        } else {
            window.history.back();
        }
    };

    return (
        <div className="min-h-screen bg-[#0b1222] py-12 px-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <header className="text-center mb-16 pb-10 border-b border-amber-500/20">
                    <div className="inline-flex items-center justify-center w-16 h-16 gold-gradient rounded-2xl shadow-xl shadow-amber-500/20 mb-6">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white w-8 h-8">
                            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                            <polyline points="16 7 22 7 22 13"></polyline>
                        </svg>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
                        GoldTrack <span className="text-amber-500">Analytics</span>
                    </h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4">
                        Financial Compliance & User Policy
                    </p>
                    <p className="text-xs text-slate-600">Last Updated: {currentMonth}</p>
                </header>

                {/* Sections */}
                <div className="space-y-8">
                    {/* Introduction */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            Introduction
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Welcome to GoldTrack Analytics. By accessing or using our platform, you acknowledge that you have read,
                            understood, and agree to be bound by these compliance policies. GoldTrack Analytics is a portfolio tracking
                            and analytics tool designed for educational and informational purposes.
                        </p>
                    </section>

                    {/* Data Privacy & Security */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            <Shield className="w-5 h-5 text-amber-500" />
                            Data Privacy & Security
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">We are committed to protecting your personal and financial data:</p>
                        <ul className="space-y-3">
                            {[
                                'User authentication is powered by Firebase Authentication with industry-standard encryption',
                                'All data transmissions are secured using TLS/SSL encryption protocols',
                                'Portfolio data is stored securely in Google Cloud Firestore with user-level access controls',
                                'We do not share, sell, or distribute your personal data to third parties',
                                'You maintain full ownership and control of your investment data at all times',
                                'Sessions are protected with secure token-based authentication'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Investment Disclaimer */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Investment Disclaimer
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">
                            GoldTrack Analytics provides market data, AI-powered insights, and portfolio tracking tools for
                            <strong className="text-white"> educational purposes only</strong>. The information displayed should not be construed as:
                        </p>
                        <ul className="space-y-3 mb-6">
                            {[
                                'Financial, investment, tax, or legal advice',
                                'Recommendations to buy, sell, or hold any securities or commodities',
                                'Guarantees of future performance or returns',
                                'Professional portfolio management services'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                            <p className="text-sm text-rose-300 leading-relaxed flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <span>
                                    <strong>Risk Warning:</strong> Investing in gold, silver, and other precious metals involves substantial
                                    risk and may result in partial or total loss of your investment. Past performance is not indicative of
                                    future results. Always consult with a qualified financial advisor before making investment decisions.
                                </span>
                            </p>
                        </div>
                    </section>

                    {/* AI-Powered Features */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            <Brain className="w-5 h-5 text-amber-500" />
                            AI-Powered Features
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">
                            Our platform utilizes Google's Generative AI (Gemini) to provide market insights, price analysis,
                            and investment signals. Please note:
                        </p>
                        <ul className="space-y-3">
                            {[
                                'AI-generated content is for informational purposes only and should not replace professional advice',
                                'Market predictions and signals are based on historical data and may not predict future outcomes',
                                'AI analysis is cached for efficiency and may not reflect real-time market conditions',
                                'Users should independently verify all AI-generated insights before making decisions'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Data Accuracy */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            <Database className="w-5 h-5 text-amber-500" />
                            Data Accuracy
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">While we strive to provide accurate and up-to-date information:</p>
                        <ul className="space-y-3">
                            {[
                                'Metal prices are fetched from various market sources and may have slight delays',
                                'Historical data is aggregated from multiple sources and may contain minor discrepancies',
                                'Portfolio valuations are estimates based on available market data',
                                'We recommend cross-referencing prices with official market sources for transactions'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* User Responsibilities */}
                    <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
                        <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
                            <Users className="w-5 h-5 text-amber-500" />
                            User Responsibilities
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">By using GoldTrack Analytics, you agree to:</p>
                        <ul className="space-y-3">
                            {[
                                'Provide accurate information when creating and maintaining your account',
                                'Keep your login credentials secure and confidential',
                                'Use the platform for lawful purposes only',
                                'Not attempt to access other users\' data or circumvent security measures',
                                'Accept full responsibility for your investment decisions'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-sm text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Contact Information - Commented out for now */}
                    {/*
          <section className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700/30">
            <h2 className="text-lg font-black text-white mb-6 flex items-center gap-3">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              Contact Information
            </h2>
            <p className="text-sm text-slate-400 mb-6">For questions or concerns regarding these policies:</p>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                <span className="text-sm text-slate-500">📧 Email:</span>
                <span className="text-sm font-bold text-white">support@goldtrack.app</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                <span className="text-sm text-slate-500">🌐 Website:</span>
                <span className="text-sm font-bold text-white">goldtrack-acd41.web.app</span>
              </div>
            </div>
          </section>
          */}

                    {/* Agreement Box */}
                    <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                        <p className="text-sm text-amber-300 font-semibold text-center">
                            By continuing to use GoldTrack Analytics, you confirm that you have read and agree to these
                            Financial Compliance policies.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <footer className="text-center mt-16 pt-10 border-t border-slate-800/50">
                    <button
                        onClick={handleReturn}
                        className="inline-flex items-center gap-3 px-8 py-4 gold-gradient rounded-2xl text-white font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to GoldTrack
                    </button>
                    <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black">
                        © {currentYear} GoldTrack Analytics. All Rights Reserved.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default CompliancePage;
