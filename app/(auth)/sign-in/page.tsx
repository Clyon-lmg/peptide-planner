import React, { useState } from 'react';
import { Moon, Sun, Beaker, CheckCircle2, ArrowRight, Lock } from 'lucide-react';

const LoginPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark based on image
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Toggle Theme Handler
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // In a real app, you'd toggle a class on the html/body tag here
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-300`}>
      
      {/* Light/Dark Toggle - Absolute Positioned */}
      <button 
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-full transition-colors ${
          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 text-slate-700 shadow-sm border border-slate-200'
        }`}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* LEFT PANE - Widened to 50% on large screens (lg:w-1/2) */}
      <div className={`hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden ${
        isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        {/* Decorative background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent opacity-40" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Beaker className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">Peptide Planner</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Research with <br/>
            <span className="text-blue-500">precision.</span>
          </h1>

          <p className={`text-lg mb-8 max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Track your inventory, visualize blood concentration levels, and optimize your protocols in one secure lab notebook.
          </p>

          <div className="space-y-4">
             {['Inventory Tracking', 'Dose Forecasting', 'Protocol Sharing'].map((feature) => (
               <div key={feature} className={`flex items-center gap-3 px-4 py-2 rounded-full w-fit ${
                 isDarkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-white/60 text-slate-700'
               }`}>
                 <CheckCircle2 size={16} className="text-blue-500" />
                 <span className="text-sm font-medium">{feature}</span>
               </div>
             ))}
          </div>
        </div>

        <div className={`relative z-10 text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          © 2026 Peptide Planner
        </div>
      </div>

      {/* RIGHT PANE - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Enter your credentials to access your lab.
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 placeholder:text-slate-500 text-white' 
                    : 'bg-white border-slate-200 placeholder:text-slate-400 text-slate-900'
                }`}
              />
            </div>

            {/* RESTORED PASSWORD INPUT */}
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 placeholder:text-slate-500 text-white' 
                    : 'bg-white border-slate-200 placeholder:text-slate-400 text-slate-900'
                }`}
              />
            </div>

            <button
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 w-full"
            >
              Sign In
            </button>
          </form>

          {/* DIVIDER */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className={`w-full border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className={`px-2 ${isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                Or continue with
              </span>
            </div>
          </div>

          {/* MAGIC LINK OPTION */}
          <button
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-10 w-full border ${
              isDarkMode 
                ? 'border-slate-800 bg-transparent hover:bg-slate-900 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
            }`}
          >
            Send Magic Link <ArrowRight className="ml-2 h-4 w-4" />
          </button>

          <p className={`px-8 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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