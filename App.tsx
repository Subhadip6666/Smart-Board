import React, { useState } from 'react';
import Smartboard from './components/Smartboard';
import { GestureMode } from './types';

const App: React.FC = () => {
  const [currentColor, setCurrentColor] = useState('#3b82f6'); // Default Blue
  const [brushSize, setBrushSize] = useState(8);
  const [activeGesture, setActiveGesture] = useState<GestureMode>(GestureMode.IDLE);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startExperience = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Just checking permission
      setHasStarted(true);
    } catch (err) {
      setError("Camera permission denied. Please enable camera access to use VisionBoard.");
    }
  };

  if (!hasStarted) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-950 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 z-0"></div>
        
        <div className="relative z-10 max-w-2xl w-full flex flex-col items-center text-center gap-10 bg-slate-900/40 backdrop-blur-3xl p-12 rounded-[3.5rem] border border-white/10 shadow-[0_0_100px_rgba(37,99,235,0.1)]">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-blue-600/20 text-blue-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-blue-500/30 mb-2">
              Experimental AI Workspace
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-500">
              VisionBoard AI
            </h1>
            <p className="text-slate-400 font-medium text-lg max-w-md mx-auto">
              Transform your desk into a digital canvas using only your hand gestures.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[
              { icon: '☝️', label: 'Draw', desc: 'Index Finger' },
              { icon: '✌️', label: 'Air UI', desc: 'Index + Middle' },
              { icon: '🤏', label: 'Erase', desc: 'Thumb Pinch' },
              { icon: '✋', label: 'Clear', desc: 'Open Palm' }
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/5 rounded-3xl p-5 flex flex-col items-center gap-2 group hover:bg-white/10 transition-all">
                <span className="text-4xl group-hover:scale-125 transition-transform duration-300">{item.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{item.label}</span>
                  <span className="text-[9px] font-medium text-slate-500">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-6 w-full">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-sm p-4 rounded-2xl w-full">
                {error}
              </div>
            )}
            
            <button
              onClick={startExperience}
              className="group relative px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-[0_15px_30px_rgba(37,99,235,0.4)] flex items-center gap-3"
            >
              <span className="text-lg">START EXPERIENCE</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold opacity-60">
              Browser-native tracking • No data leaves your device
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      <header className="absolute top-0 left-0 w-full z-40 p-6 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto group">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
               <span className="text-xl">✨</span>
             </div>
             <div>
               <h1 className="text-xl font-black tracking-tight text-white">VisionBoard AI</h1>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vision Active</span>
               </div>
             </div>
          </div>
        </div>

        <div className="flex gap-4 pointer-events-auto">
          <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/5 shadow-2xl">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Status</span>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2
              ${activeGesture === GestureMode.DRAW ? 'bg-blue-500/20 text-blue-400' : 
                activeGesture === GestureMode.ERASE ? 'bg-red-500/20 text-red-400' : 
                activeGesture === GestureMode.SELECT ? 'bg-purple-500/20 text-purple-400' :
                'bg-slate-800 text-slate-400'}`}>
              {activeGesture}
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="p-3 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/5 hover:bg-slate-800 transition-colors text-slate-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        <Smartboard 
          color={currentColor} 
          setColor={setCurrentColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          onGestureChange={setActiveGesture}
        />
      </main>

      <footer className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-8 bg-slate-900/80 backdrop-blur-3xl px-10 py-5 rounded-[2.5rem] border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Color Palette</label>
          <div className="flex gap-3">
            {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'].map(c => (
              <button
                key={c}
                onClick={() => setCurrentColor(c)}
                className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${currentColor === c ? 'border-white scale-110 ring-4 ring-white/10 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="h-12 w-px bg-white/10" />

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Brush Dynamics</label>
          <div className="flex items-center gap-4">
             <input 
              type="range" 
              min="2" 
              max="40" 
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-40 accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="bg-slate-800 px-3 py-1 rounded-lg text-[10px] font-black text-slate-300 min-w-[40px] text-center border border-white/5">
              {brushSize}PX
            </div>
          </div>
        </div>

        <div className="h-12 w-px bg-white/10" />

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Shortcuts</label>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xl">☝️</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">Draw</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl">✌️</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">Select</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl">🤏</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">Erase</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl">✋</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">Reset</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;