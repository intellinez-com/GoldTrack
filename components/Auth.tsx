
import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, LogIn, Github, ArrowRight, Loader2, TrendingUp, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { AuthMode, User } from '../types';
import CompliancePage from './CompliancePage';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resetPassword
} from '../services/authService';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCompliance, setShowCompliance] = useState(false);

  const getFirebaseErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'Credential Conflict: This email is already registered in our vault. Please login instead.',
      'auth/invalid-email': 'Invalid Email: Please provide a valid email address.',
      'auth/operation-not-allowed': 'Operation Denied: This authentication method is not enabled.',
      'auth/weak-password': 'Weak Security Key: Password should be at least 6 characters.',
      'auth/user-disabled': 'Account Suspended: This investor profile has been disabled.',
      'auth/user-not-found': 'Identity Error: No investor profile matches this email intelligence.',
      'auth/wrong-password': 'Security Violation: The provided key does not match our records.',
      'auth/invalid-credential': 'Authentication Failed: Invalid email or password.',
      'auth/too-many-requests': 'Rate Limited: Too many attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Authentication Cancelled: The sign-in popup was closed.',
      'auth/network-request-failed': 'Network Error: Please check your internet connection.',
      'auth/internal-error': 'Internal Error: An unexpected error occurred. Please try again.'
    };
    return errorMessages[errorCode] || `Authentication Error: ${errorCode}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Profile orchestration failed: Please provide your full legal name.');
          setIsLoading(false);
          return;
        }

        const user = await signUpWithEmail(email, password, name);
        setSuccess('Vault created successfully. Authorizing session...');
        setTimeout(() => onAuthSuccess(user), 1000);
      }
      else if (mode === 'login') {
        const user = await signInWithEmail(email, password);
        setSuccess('Access granted. Synchronizing portfolio data...');
        setTimeout(() => onAuthSuccess(user), 1000);
      }
      else if (mode === 'forgot-password') {
        await resetPassword(email);
        setSuccess('Recovery Dispatched: A security reset link has been sent to your inbox.');
        setIsLoading(false);
      }
    } catch (err: any) {
      const errorCode = err.code || 'auth/internal-error';
      setError(getFirebaseErrorMessage(errorCode));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const user = await signInWithGoogle();
      setSuccess('Google Identity Verified. Accessing vault...');
      setTimeout(() => onAuthSuccess(user), 1000);
    } catch (err: any) {
      const errorCode = err.code || 'auth/internal-error';
      setError(getFirebaseErrorMessage(errorCode));
      setIsLoading(false);
    }
  };

  // Show compliance page if requested
  if (showCompliance) {
    return <CompliancePage onClose={() => setShowCompliance(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b1222] relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 gold-gradient rounded-2xl shadow-xl shadow-amber-500/20 mb-4 animate-bounce-slow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white w-8 h-8">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">GoldTrack <span className="text-amber-500">Analytics</span></h1>
          <p className="text-slate-400 font-medium">Elevate your wealth management intelligence</p>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] border border-slate-700/50 shadow-2xl backdrop-blur-3xl transition-all duration-500">

          {mode !== 'forgot-password' ? (
            <div className="flex bg-slate-900/50 p-1 rounded-2xl mb-8 border border-slate-800">
              <button
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Secure Login
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'signup' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Open Vault
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-500 transition-colors mb-6 group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
              Return to Login
            </button>
          )}

          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">
              {mode === 'login' ? 'Investor Authentication' : mode === 'signup' ? 'Register Portfolio' : 'Vault Recovery'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'login' ? 'Enter credentials to access your financial data.' : mode === 'signup' ? 'Establish your private wealth tracking profile.' : 'Synchronize a recovery link to restore access.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Identity Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Intelligence</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@goldtrack.com"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>

            {mode !== 'forgot-password' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Key</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-password'); setError(null); setSuccess(null); }}
                      className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      Forgot Key?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required={mode !== 'forgot-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-rose-400 font-bold leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-emerald-400 font-bold leading-relaxed">{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl gold-gradient text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Authorize Access' : mode === 'signup' ? 'Create Portfolio' : 'Dispatch Recovery'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {mode !== 'forgot-password' && (
            <>
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-slate-500 bg-[#161d2b] px-4 mx-auto w-fit rounded-full border border-slate-800">or connect with</div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google Identity
              </button>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          By continuing, you agree to our <button type="button" onClick={() => setShowCompliance(true)} className="text-amber-500 cursor-pointer hover:underline">Financial Compliance</button> policies.
        </p>
      </div>
    </div>
  );
};

export default Auth;
