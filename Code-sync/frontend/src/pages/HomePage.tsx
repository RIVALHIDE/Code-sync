import illustration from "@/assets/illustration.svg";
import FormComponent from "@/components/forms/FormComponent";

function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0b0f17] text-slate-100 overflow-hidden font-sans p-4">
      {/* Background Radial Glow Effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Glassmorphism Outer Wrapper */}
<div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-between gap-10 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/20 md:flex-row md:p-12">        
        {/* Left Side: Hero Brand Info & Illustration */}
        <div className="flex w-full flex-col items-start justify-center gap-6 md:w-1/2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Realtime Pair Programming
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Code & Sync <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              In Perfect Harmony
            </span>
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-slate-400">
            A seamless collaborative code editor equipped with instant execution, live multiplayer sync, and integrated AI capabilities.
          </p>

          <div className="w-full max-w-sm pt-2">
            <img 
              src={illustration} 
              alt="Code Sync Illustration" 
              className="w-full max-h-56 object-contain animate-up-down drop-shadow-[0_10px_20px_rgba(16,185,129,0.15)]"
            />
          </div>
        </div>

        {/* Right Side: Form Component */}
        <div className="w-full md:w-1/2">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 sm:p-8 shadow-inner">
            <FormComponent />
          </div>
        </div>

      </div>
    </div>
  );
}

export default HomePage;