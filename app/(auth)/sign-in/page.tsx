'use client';

import React, { useState } from 'react';
import { Moon, Sun, Beaker, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New state for loading

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // --- NEW FUNCTION TO HANDLE MAGIC LINK ---
  const handleMagicLink = async () => {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }

    setIsLoading(true);

    // SIMULATE API CALL (Replace this with your actual DB/Auth call)
    try {
      console.log(`Sending magic link to: ${email}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Fake 2s delay
      alert(`Magic link sent to ${email}!`);
    } catch (error) {
      console.error("Error sending link:", error);
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

          <p className={`text-xl mb-10 max-w-lg ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Track your inventory, visualize blood concentration levels, and optimize your protocols in one secure lab notebook.
          </p>

          <div className="space-y-5">
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

        <div className={`absolute bottom-8 left-16 text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          © 2026 Peptide Planner
        </div>
      </div>

      {/* RIGHT PANE */}
      <div className="flex items-center justify-center p-8 w-full h-full">
        <div className="w-full max-w-xl space-y-10">
          
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className={`mt-3 text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Enter your credentials to access your lab.
            </p>
          </div>

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
              <input
                type="email"
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
              className="inline-flex items-center justify-center rounded-lg text-base font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700 h-12 w-full"
            >
              Sign In
            </button>
          </form>

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

          {/* UPDATED MAGIC LINK BUTTON */}
          <button
            onClick={handleMagicLink}
            disabled={isLoading}
            className={`inline-flex items-center justify-center rounded-lg text-base font-medium transition-colors h-12 w-full border ${
              isDarkMode 
                ? 'border-slate-800 bg-transparent hover:bg-slate-900 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending...
              </>
            ) : (
              <>
                Send Magic Link <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>

          <p className={`text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            By clicking continue, you agree to our{' '}
            <a href="#" className="underline underline-offset-4 hover:text-blue-500">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="underline underline-offset-4 hover:text-blue-500">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;