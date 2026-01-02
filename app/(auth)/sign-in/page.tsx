import SignInForm from "./SignInForm";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";

// Force dynamic rendering to prevent build-time Supabase connection issues
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      
      {/* LEFT COLUMN: Branding / Splash (Hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 text-white p-12 relative overflow-hidden">
          {/* Ambient Background Effects */}
          <div className="absolute inset-0 bg-zinc-900"></div>
          {/* Blue glow top right */}
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]"></div>
          {/* Emerald glow bottom left */}
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px]"></div>
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>

          {/* Logo Top Left */}
          <div className="relative z-10 flex items-center gap-3 font-bold text-xl tracking-tight">
             <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-xl">
                <FlaskConical className="size-5 text-white" />
             </div>
             Peptide Planner
          </div>

          {/* Hero Content */}
          <div className="relative z-10 space-y-6 max-w-lg mb-20">
             <h1 className="text-5xl font-bold tracking-tight leading-tight">
                Research with <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">precision.</span>
             </h1>
             <p className="text-zinc-400 text-lg leading-relaxed">
                Track your inventory, visualize blood concentration levels, and optimize your protocols in one secure lab notebook.
             </p>
             
             {/* Feature pills */}
             <div className="flex gap-3 pt-4">
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300">Inventory Tracking</div>
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300">Dose Forecasting</div>
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300">Protocol Sharing</div>
             </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-xs text-zinc-600 font-medium">
             &copy; {new Date().getFullYear()} Peptide Planner
          </div>
      </div>

      {/* RIGHT COLUMN: Form */}
      <div className="flex flex-col items-center justify-center p-6 bg-background relative">
          <div className="w-full max-w-[380px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             
             {/* Header */}
             <div className="flex flex-col space-y-2 text-center">
                {/* Mobile-only Logo */}
                <div className="lg:hidden mx-auto size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                    <FlaskConical className="size-6" />
                </div>
                
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                    Enter your email below to access your lab.
                </p>
             </div>

             {/* The Form Component */}
             <Suspense>
                <SignInForm />
             </Suspense>

             {/* Footer Links */}
             <p className="px-8 text-center text-xs text-muted-foreground">
                By clicking continue, you agree to our{" "}
                <a href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
             </p>
          </div>
      </div>
    </div>
  )
}