import React from 'react';
import {
    TrendingUp, Shield, Brain, Zap, BarChart3, Globe2,
    ChevronRight, Sparkles, ArrowRight, CheckCircle2,
    Coins, LineChart, PieChart, Lock
} from 'lucide-react';

interface LandingPageProps {
    onLogin: () => void;
    onSignup: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSignup }) => {
    const features = [
        {
            icon: <LineChart className="w-6 h-6" />,
            title: 'Real-Time Tracking',
            description: 'Monitor your gold & silver investments with live market prices updated every session.'
        },
        {
            icon: <Brain className="w-6 h-6" />,
            title: 'AI-Powered Insights',
            description: 'Get intelligent market analysis, sentiment scores, and expert outlook summaries powered by Gemini AI.'
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            title: 'Smart Advisor',
            description: 'Receive buy/sell signals based on 50-day and 200-day moving average technical analysis.'
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'Bank-Grade Security',
            description: 'Your data is protected with Firebase Authentication and encrypted cloud storage.'
        },
        {
            icon: <Globe2 className="w-6 h-6" />,
            title: 'Multi-Currency',
            description: 'Track your portfolio in INR, USD, EUR, GBP, AED and more global currencies.'
        },
        {
            icon: <PieChart className="w-6 h-6" />,
            title: 'Portfolio Analytics',
            description: 'Visualize asset allocation, track P/L performance, and monitor investment growth.'
        }
    ];

    const steps = [
        { step: '01', title: 'Create Account', desc: 'Sign up in seconds with email or Google' },
        { step: '02', title: 'Add Investments', desc: 'Log your gold & silver purchases with details' },
        { step: '03', title: 'Track & Analyze', desc: 'Watch your wealth grow with AI insights' }
    ];

    return (
        <div className="min-h-screen bg-[#0b1222] text-white overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[150px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-amber-500/5 blur-[100px] rounded-full"></div>
            </div>

            {/* Navigation */}
            <nav className="relative z-50 px-6 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white w-5 h-5">
                                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                                <polyline points="16 7 22 7 22 13"></polyline>
                            </svg>
                        </div>
                        <span className="text-xl font-black tracking-tight">GoldTrack<span className="text-amber-500">.</span></span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onLogin}
                            className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white transition-colors"
                        >
                            Login
                        </button>
                        <button
                            onClick={onSignup}
                            className="px-5 py-2.5 text-sm font-bold gold-gradient text-white rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all hover:scale-105 active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 px-6 pt-16 pb-24">
                <div className="max-w-7xl mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">AI-Powered Wealth Intelligence</span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
                            Master Your
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600">
                                Precious Metals
                            </span>
                            Portfolio
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Track, analyze, and optimize your gold & silver investments with real-time market data and AI-powered buy/sell signals.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={onSignup}
                                className="group flex items-center gap-3 px-8 py-4 gold-gradient text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-105 active:scale-95"
                            >
                                Start Free
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={onLogin}
                                className="flex items-center gap-3 px-8 py-4 bg-slate-800/50 text-slate-300 font-bold text-sm uppercase tracking-widest rounded-2xl border border-slate-700 hover:border-amber-500/50 hover:text-white transition-all"
                            >
                                <Lock className="w-4 h-4" />
                                Sign In
                            </button>
                        </div>

                        {/* Trust Badges */}
                        <div className="flex items-center justify-center gap-8 mt-12">
                            <div className="flex items-center gap-2 text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold uppercase tracking-widest">Free to Use</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Credit Card</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold uppercase tracking-widest">Secure & Private</span>
                            </div>
                        </div>
                    </div>

                    {/* Floating Coins Animation */}
                    <div className="relative mt-20 max-w-4xl mx-auto">
                        <div className="glass-card rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="glass-card rounded-2xl p-6 border border-slate-700/30 text-center">
                                    <Coins className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                                    <p className="text-2xl font-black text-white">₹8,245</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gold / Gram</p>
                                </div>
                                <div className="glass-card rounded-2xl p-6 border border-slate-700/30 text-center">
                                    <TrendingUp className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-2xl font-black text-emerald-500">+12.4%</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">YTD Returns</p>
                                </div>
                                <div className="glass-card rounded-2xl p-6 border border-slate-700/30 text-center">
                                    <Brain className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                                    <p className="text-2xl font-black text-amber-500">BULLISH</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">AI Signal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative z-10 px-6 py-24 bg-gradient-to-b from-transparent to-slate-900/50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-amber-500 text-xs font-black uppercase tracking-[0.3em] mb-4">Features</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                            Everything You Need to
                            <span className="text-amber-500"> Succeed</span>
                        </h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                            Professional-grade tools for tracking and optimizing your precious metals investments.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group glass-card rounded-3xl p-8 border border-slate-700/30 hover:border-amber-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10"
                            >
                                <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-black text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="relative z-10 px-6 py-24">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-amber-500 text-xs font-black uppercase tracking-[0.3em] mb-4">How It Works</p>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                            Get Started in <span className="text-amber-500">Minutes</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((item, index) => (
                            <div key={index} className="text-center">
                                <div className="relative inline-block mb-6">
                                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                                        <span className="text-2xl font-black text-amber-500">{item.step}</span>
                                    </div>
                                    {index < 2 && (
                                        <ChevronRight className="absolute top-1/2 -right-12 transform -translate-y-1/2 w-6 h-6 text-slate-600 hidden md:block" />
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-white mb-2">{item.title}</h3>
                                <p className="text-slate-400 text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 px-6 py-24">
                <div className="max-w-4xl mx-auto">
                    <div className="glass-card rounded-[2.5rem] p-12 md:p-16 border border-amber-500/20 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent"></div>
                        <div className="relative z-10">
                            <div className="w-16 h-16 gold-gradient rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-amber-500/30">
                                <Zap className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                                Ready to Transform Your
                                <span className="text-amber-500"> Investment Strategy?</span>
                            </h2>
                            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
                                Join investors who use AI-powered insights to make smarter decisions about their gold & silver portfolios.
                            </p>
                            <button
                                onClick={onSignup}
                                className="group inline-flex items-center gap-3 px-10 py-5 gold-gradient text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-105 active:scale-95"
                            >
                                Create Free Account
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 px-6 py-12 border-t border-slate-800">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 gold-gradient rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white w-4 h-4">
                                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                                <polyline points="16 7 22 7 22 13"></polyline>
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-slate-500">© {new Date().getFullYear()} GoldTrack Analytics</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Powered by Gemini AI</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
