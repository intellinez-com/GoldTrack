
import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Globe, Mail, User as UserIcon, CheckCircle2, AlertCircle, ChevronDown, Plus, Trash2, Database, Link as LinkIcon, RotateCcw } from 'lucide-react';
import { User, SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, DataSource } from '../types';
import { RECOMMENDED_SOURCES_BY_CURRENCY } from '../constants';
import { updateUserProfile } from '../services/authService';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../src/firebase';

interface ProfileSettingsProps {
  user: User;
  onSave: (updatedUser: User) => void;
  onCancel: () => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onSave, onCancel }) => {
  const [name, setName] = useState(user.name);
  const [country, setCountry] = useState(user.country || 'IN');
  const [currency, setCurrency] = useState(user.currency || 'INR');
  const [sources, setSources] = useState<DataSource[]>(user.sources || []);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // New Source State
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  // Initialize with defaults if user has no sources
  useEffect(() => {
    if (sources.length === 0) {
      const defaults = RECOMMENDED_SOURCES_BY_CURRENCY[currency] || [];
      setSources(defaults);
    }
  }, []);

  const handleAddSource = () => {
    if (!newSourceName.trim()) return;
    const newSource: DataSource = {
      id: crypto.randomUUID(),
      name: newSourceName.trim(),
      url: newSourceUrl.trim() || undefined,
      isRecommended: false
    };
    setSources([...sources, newSource]);
    setNewSourceName('');
    setNewSourceUrl('');
  };

  const handleRemoveSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  const handleResetSources = () => {
    const defaults = RECOMMENDED_SOURCES_BY_CURRENCY[currency] || RECOMMENDED_SOURCES_BY_CURRENCY['INR'] || [];
    setSources(defaults);
  };

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    // If user hasn't added any custom sources (all are recommended), update to new defaults
    if (sources.every(s => s.isRecommended)) {
      setSources(RECOMMENDED_SOURCES_BY_CURRENCY[newCurr] || []);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      // Validate password change if attempted
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setMessage({ type: 'error', text: 'New passwords do not match' });
          setIsSaving(false);
          return;
        }
        if (newPassword.length < 6) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
          setIsSaving(false);
          return;
        }
        if (!oldPassword) {
          setMessage({ type: 'error', text: 'Please enter your current password to change it' });
          setIsSaving(false);
          return;
        }

        // Re-authenticate and update password
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email) {
          try {
            const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPassword);
          } catch (authError: any) {
            if (authError.code === 'auth/wrong-password') {
              setMessage({ type: 'error', text: 'Current password is incorrect' });
            } else if (authError.code === 'auth/requires-recent-login') {
              setMessage({ type: 'error', text: 'Please log out and log in again before changing password' });
            } else {
              setMessage({ type: 'error', text: 'Failed to update password. Please try again.' });
            }
            setIsSaving(false);
            return;
          }
        }
      }

      // Update profile in Firestore
      const updatedUser = await updateUserProfile(user.id, {
        name,
        country,
        currency,
        sources
      });

      setIsSaving(false);
      setMessage({ type: 'success', text: 'Profile updated successfully' });

      // Clear password fields
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onSave(updatedUser);
      }, 1000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
      setIsSaving(false);
    }
  };

  const inputClasses = "w-full h-[52px] bg-slate-800/50 border border-slate-700 rounded-2xl px-4 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600";
  const labelClasses = "block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2";

  // Check if user signed in with Google (no password change for OAuth users)
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  return (
    <div className="glass-card rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden shadow-2xl max-w-4xl w-full border border-slate-700/50 max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="absolute top-0 left-0 w-full h-1 gold-gradient"></div>

      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-xl shadow-amber-500/20">
            <UserIcon className="text-white w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Vault Configuration</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Market Intelligence & Security</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-slate-400 active:scale-95 shadow-lg border border-slate-700/30">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Data Sources & Localization */}
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Pricing Data Sources</h3>
                </div>
                <button
                  type="button"
                  onClick={handleResetSources}
                  className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest hover:text-amber-500 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Regional Defaults
                </button>
              </div>

              <div className="space-y-4">
                {/* Add new source form */}
                <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Source Name</label>
                      <input
                        type="text"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder="e.g. MCX India"
                        className="w-full h-10 bg-slate-800/80 border border-slate-700 rounded-xl px-3 text-xs text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">URL (Optional)</label>
                      <input
                        type="text"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-10 bg-slate-800/80 border border-slate-700 rounded-xl px-3 text-xs text-slate-200 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSource}
                    className="w-full py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Add Provider
                  </button>
                </div>

                {/* Source list */}
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {sources.map(source => (
                    <div key={source.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50 group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg shrink-0 ${source.isRecommended ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-700/50 text-slate-400'}`}>
                          <LinkIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-200 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{source.name}</span>
                            {source.isRecommended && <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500 font-black uppercase tracking-tighter shrink-0">Default</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{source.url || 'Search Grounding'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(source.id)}
                        className="p-2 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {sources.length === 0 && (
                    <div className="text-center py-6 px-4 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
                      <p className="text-slate-500 text-xs font-bold mb-3">No data providers configured.</p>
                      <p className="text-slate-600 text-[10px] mb-4">The AI will auto-discover sources, but for better accuracy, add your preferred providers.</p>
                      <button
                        type="button"
                        onClick={handleResetSources}
                        className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all"
                      >
                        Restore Regional Defaults
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
                <Globe className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Localization</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                  <label className={labelClasses}>Region</label>
                  <div className="relative group">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={`${inputClasses} appearance-none cursor-pointer pr-10`}
                    >
                      {SUPPORTED_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClasses}>Currency</label>
                  <div className="relative group">
                    <select
                      value={currency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className={`${inputClasses} appearance-none cursor-pointer pr-10`}
                    >
                      {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Identity & Security */}
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
                <UserIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Public Profile</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className={labelClasses}>Legal Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-2 opacity-60">
                  <label className={labelClasses}>Verified Email Intelligence</label>
                  <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl h-[52px] px-4 text-sm text-slate-500 cursor-not-allowed">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
                <Shield className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Vault Security</h3>
              </div>

              {isGoogleUser ? (
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You signed in with Google. Password management is handled by your Google account.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className={labelClasses}>Current Security Key</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClasses}>New Security Key</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClasses}>Confirm New Key</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div className={`p-5 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-lg ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
            <span className="text-sm font-bold">{message.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 px-8 rounded-2xl font-black text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-all uppercase tracking-[0.2em] border border-transparent hover:border-slate-700"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-[2] py-4 px-8 rounded-2xl gold-gradient text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-amber-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> : <Save className="w-5 h-5" />}
            Commit Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
