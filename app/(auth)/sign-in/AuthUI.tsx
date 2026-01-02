'use client';

import React, { useState } from 'react';
import { Moon, Sun, Beaker, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

// Define the shape of the props this component expects
type AuthUIProps = {
  sendMagicLink: (formData: FormData) => Promise<void>;
  signInWithPassword: (prevState: any, formData: FormData) => Promise<{ error: string } | void>;
  redirectUrl?: string;
  errorMessage?: string;
  message?: string;
};

export default function AuthUI({ 
  sendMagicLink, 
  signInWithPassword, 
  redirectUrl = "", 
  errorMessage = "",
  message = ""
}: AuthUIProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState(errorMessage);
  const [localMessage, setLocalMessage] = useState(message);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- HANDLER: Password Login ---
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    setLocalMessage('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('redirect', redirectUrl);

    try {
      // Pass an empty object as the first argument (prevState) because your server action expects it
      const result = await signInWithPassword({ error: '' }, formData);
      if (result && result.error) {
        setLocalError(result.error);
        setIsLoading(false);
      }
      // If success, the server action calls redirect(), so we don't need to do anything here
    } catch (err) {
      setLocalError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  // --- HANDLER: Magic Link ---
  const handleMagicLink = async () => {
    if (!email) {
      setLocalError("Please enter your email address first.");
      return;
    }

    setIsLoading(true);
    setLocalError('');
    
    const formData = new FormData();
    formData.append('email', email);
    formData.append('redirect', redirectUrl);

    try {
      await sendMagicLink(formData);
      setLocalMessage("Magic link sent! Check your email to sign in.");
      setLocalError(''); // clear any errors
    } catch (err) {
      setLocalError("Failed to send magic link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 w-full h-full grid lg:grid-cols-2 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-300 overflow-y-auto`}>
      
      {/* Light/Dark Toggle */}
      <button 
        onClick={toggleTheme}
        className={`absolute top-6 right-6 z-[60] p-3 rounded-full transition-colors ${
          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 text-slate-700 shadow-sm border border-slate-200'
        }`}
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {/* LEFT PANE */}
      <div className={`hidden lg:flex flex-col justify-center p-16 relative overflow-hidden ${
        isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent opacity-40 pointer-events-none" />

        <div className="relative z-10 w-full max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Beaker className="text-white" size={32} />
            </div>
            <span className="text-2xl font-bold tracking-tight">Peptide Planner</span>
          </div>

          <h1 className="text-6xl font-extrabold tracking-tight mb-8 leading-tight">
            Research with <br/>
            <span className="text-blue-500">precision.</span>
          </h1>

          <div className="space-y-5 mt-10">
             {['Inventory Tracking', 'Dose Forecasting', 'Protocol Sharing'].map((feature) => (
               <div key={feature} className={`flex items-center gap-4 px-6 py-3 rounded-full w-fit ${
                 isDarkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-white/60 text-slate-700'
               }`}>
                 <CheckCircle2 size={20} className="text-blue-500" />
                 <span className="text-base font-medium">{feature}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANE (Auth Form) */}
      <div className="flex items-center justify-center p-8 w-full h-full">
        <div className="w-full max-w-xl space-y-8">
          
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className={`mt-3 text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Enter your credentials to access your lab.
            </p>
          </div>

          {/* Feedback Messages */}
          {localError && (
             <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium text-center">
               {localError}
             </div>
          )}
          {localMessage && !localError && (
             <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-medium text-center">
               {localMessage}
             </div>
          )}

          <form className="space-y-6" onSubmit={handlePasswordLogin}>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`flex h-12 w-full rounded-lg border px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 placeholder:text-slate-600 text-white' 
                    : 'bg-white border-slate-200 placeholder:text-slate-400 text-slate-900'
                }`}
              />
            </div>

            <div className="space-y-2">
               <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                <a href="#" className="text-sm text-blue-500 hover:text-blue-400">Forgot password?</a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`flex h-12 w-full rounded-lg border px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 placeholder:text-slate-600 text-white' 
                    : 'bg-white border-slate-200 placeholder:text-slate-400 text-slate-900'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg text-base font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700 h-12 w-full disabled:opacity-50"
            >
              {isLoading && password ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Sign In
            </button>
          </form>

          {/* DIVIDER */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className={`w-full border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`px-4 ${isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                Or continue with
              </span>
            </div>
          </div>

          {/* MAGIC LINK BUTTON */}
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={isLoading}
            className={`inline-flex items-center justify-center rounded-lg text-base font-medium transition-colors h-12 w-full border ${
              isDarkMode 
                ? 'border-slate-800 bg-transparent hover:bg-slate-900 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading && !password ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending...
              </>
            ) : (
              <>
                Send Magic Link <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}