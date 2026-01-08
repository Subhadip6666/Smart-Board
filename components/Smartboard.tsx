import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GestureMode, Point, HandLandmark } from '../types';
import { GoogleGenAI } from '@google/genai';

interface SmartboardProps {
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onGestureChange: (mode: GestureMode) => void;
}

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ffffff', label: 'White' },
];

const SIZE_OPTIONS = [
  { value: 5, label: 'Small' },
  { value: 12, label: 'Medium' },
  { value: 25, label: 'Large' },
];

const Smartboard: React.FC<SmartboardProps> = ({ color, setColor, brushSize, setBrushSize, onGestureChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null); 
  const activeStrokeCanvasRef = useRef<HTMLCanvasElement>(null); 
  
  const [isReady, setIsReady] = useState(false);
  const [initStatus, setInitStatus] = useState("Waking up sensors...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{ type: 'color' | 'size', value: any } | null>(null);
  const [selectionProgress, setSelectionProgress] = useState(0); 
  const dwellStartTime = useRef<number | null>(null);
  const DWELL_DURATION = 650;

  const lastPointRef = useRef<Point | null>(null);
  const currentPathRef = useRef<Point[]>([]);
  const currentModeRef = useRef<GestureMode>(GestureMode.IDLE);
  const smoothingFactor = 0.35;

  const initializedRef = useRef(false);
  const onResultsRef = useRef<((results: any) => void) | null>(null);

  const getCanvasContexts = useCallback(() => {
    const perm = drawingCanvasRef.current?.getContext('2d');
    const temp = activeStrokeCanvasRef.current?.getContext('2d');
    const debug = canvasRef.current?.getContext('2d');
    return { perm, temp, debug };
  }, []);

  const drawPerfectShape = (points: Point[], ctx: CanvasRenderingContext2D) => {
    if (points.length < 12) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 20 && height < 20) return false; 

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const start = points[0];
    const end = points[points.length - 1];
    const distStartEnd = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    
    let pathLen = 0;
    for (let i = 1; i < points.length; i++) {
      pathLen += Math.sqrt(Math.pow(points[i].x - points[i-1].x, 2) + Math.pow(points[i].y - points[i-1].y, 2));
    }
    const isClosed = distStartEnd < (pathLen * 0.2) || distStartEnd < 50;

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!isClosed && distStartEnd > pathLen * 0.85) {
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      return true;
    }

    if (isClosed) {
      const radiusX = width / 2;
      const radiusY = height / 2;
      let circularityVariance = 0;
      points.forEach(p => {
        const d = Math.sqrt(Math.pow((p.x - centerX) / (radiusX || 1), 2) + Math.pow((p.y - centerY) / (radiusY || 1), 2));
        circularityVariance += Math.pow(d - 1, 2);
      });
      
      if (Math.sqrt(circularityVariance / points.length) < 0.18) {
        ctx.beginPath(); ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.stroke();
        return true;
      }

      ctx.strokeRect(minX, minY, width, height);
      return true;
    }
    return false;
  };

  const finalizeStroke = useCallback(() => {
    const { perm, temp } = getCanvasContexts();
    if (!perm || !temp || currentPathRef.current.length === 0) return;
    
    temp.clearRect(0, 0, activeStrokeCanvasRef.current!.width, activeStrokeCanvasRef.current!.height);
    
    if (!drawPerfectShape(currentPathRef.current, perm)) {
      perm.beginPath();
      perm.strokeStyle = color;
      perm.lineWidth = brushSize;
      perm.lineCap = 'round';
      perm.lineJoin = 'round';
      perm.moveTo(currentPathRef.current[0].x, currentPathRef.current[0].y);
      currentPathRef.current.forEach(p => perm.lineTo(p.x, p.y));
      perm.stroke();
    }
    
    currentPathRef.current = [];
    lastPointRef.current = null;
  }, [color, brushSize, getCanvasContexts]);

  const updateGestureMode = useCallback((mode: GestureMode) => {
    if (currentModeRef.current !== mode) {
      if (currentModeRef.current === GestureMode.DRAW) finalizeStroke();
      currentModeRef.current = mode;
      onGestureChange(mode);
      if (mode !== GestureMode.SELECT) {
        setCursorPos(null);
        setHoverTarget(null);
        setSelectionProgress(0);
        dwellStartTime.current = null;
      }
    }
  }, [finalizeStroke, onGestureChange]);

  const handleSelectionDwell = useCallback((type: 'color' | 'size', value: any) => {
    if (hoverTarget?.value === value) {
      if (!dwellStartTime.current) {
        dwellStartTime.current = Date.now();
        setSelectionProgress(0);
      } else {
        const elapsed = Date.now() - dwellStartTime.current;
        const progress = Math.min(100, (elapsed / DWELL_DURATION) * 100);
        setSelectionProgress(progress);
        
        if (elapsed > DWELL_DURATION) {
          if (type === 'color') setColor(value);
          else if (type === 'size') setBrushSize(value);
          dwellStartTime.current = null; 
          setSelectionProgress(0);
        }
      }
    } else {
      setHoverTarget({ type, value });
      dwellStartTime.current = Date.now();
      setSelectionProgress(0);
    }
  }, [hoverTarget, setColor, setBrushSize]);

  const drawOnCanvas = useCallback((landmark: HandLandmark, isEraser: boolean) => {
    const { perm, temp } = getCanvasContexts();
    if (!temp || !perm) return;

    const targetX = (1 - landmark.x) * temp.canvas.width;
    const targetY = landmark.y * temp.canvas.height;

    const x = lastPointRef.current ? lastPointRef.current.x + (targetX - lastPointRef.current.x) * smoothingFactor : targetX;
    const y = lastPointRef.current ? lastPointRef.current.y + (targetY - lastPointRef.current.y) * smoothingFactor : targetY;

    if (isEraser) {
      perm.globalCompositeOperation = 'destination-out';
      perm.lineWidth = brushSize * 6;
      perm.beginPath();
      if (lastPointRef.current) perm.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      perm.lineTo(x, y); perm.stroke();
      perm.globalCompositeOperation = 'source-over';
    } else {
      temp.strokeStyle = color; 
      temp.lineWidth = brushSize; 
      temp.lineCap = 'round';
      temp.lineJoin = 'round';
      temp.beginPath();
      if (lastPointRef.current) temp.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      temp.lineTo(x, y); 
      temp.stroke();
      currentPathRef.current.push({ x, y });
    }
    lastPointRef.current = { x, y };
  }, [brushSize, color, getCanvasContexts]);

  const processGesture = useCallback((landmarks: HandLandmark[]) => {
    if (!landmarks || landmarks.length < 21) return;

    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const isIndexUp = indexTip.y < landmarks[6].y;
    const isMiddleUp = middleTip.y < landmarks[10].y;
    const isRingUp = ringTip.y < landmarks[14].y;
    const isPinkyUp = pinkyTip.y < landmarks[18].y;

    const pinchDistance = Math.sqrt(Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2));

    const normX = (1 - indexTip.x);
    const normY = indexTip.y;

    let mode = GestureMode.IDLE;
    
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
      mode = GestureMode.CLEAR;
      const { perm } = getCanvasContexts();
      perm?.clearRect(0, 0, drawingCanvasRef.current!.width, drawingCanvasRef.current!.height);
    } 
    else if (pinchDistance < 0.04) {
      mode = GestureMode.ERASE;
      drawOnCanvas(indexTip, true);
    } 
    else if (isIndexUp && isMiddleUp && !isRingUp) {
      mode = GestureMode.SELECT;
      setCursorPos({ x: normX * window.innerWidth, y: normY * window.innerHeight });
      
      if (normX < 0.15) {
        const colorIndex = Math.floor(normY * COLOR_OPTIONS.length);
        if (colorIndex >= 0 && colorIndex < COLOR_OPTIONS.length) {
          handleSelectionDwell('color', COLOR_OPTIONS[colorIndex].value);
        }
      } else if (normX > 0.85) {
        const sizeIndex = Math.floor(normY * SIZE_OPTIONS.length);
        if (sizeIndex >= 0 && sizeIndex < SIZE_OPTIONS.length) {
          handleSelectionDwell('size', SIZE_OPTIONS[sizeIndex].value);
        }
      } else {
        setHoverTarget(null);
        setSelectionProgress(0);
        dwellStartTime.current = null;
      }
    } 
    else if (isIndexUp) {
      mode = GestureMode.DRAW;
      drawOnCanvas(indexTip, false);
    }

    updateGestureMode(mode);
  }, [brushSize, color, drawOnCanvas, updateGestureMode, handleSelectionDwell, getCanvasContexts]);

  useEffect(() => {
    onResultsRef.current = (results: any) => {
      const { debug } = getCanvasContexts();
      if (!debug) return;
      debug.clearRect(0, 0, debug.canvas.width, debug.canvas.height);
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        processGesture(results.multiHandLandmarks[0]);
      } else {
        updateGestureMode(GestureMode.IDLE);
      }
    };
  }, [processGesture, updateGestureMode, getCanvasContexts]);

  useEffect(() => {
    if (initializedRef.current || !videoRef.current) return;
    initializedRef.current = true;

    const initEngine = async () => {
      try {
        setInitStatus("Waking up sensors...");
        let retry = 0;
        const win = window as any;
        
        // Increased timeout to 10 seconds for slower connections
        while ((typeof win.Hands === 'undefined' || typeof win.Camera === 'undefined') && retry < 100) {
          await new Promise(r => setTimeout(r, 100));
          retry++;
        }

        if (typeof win.Hands === 'undefined' || typeof win.Camera === 'undefined') {
          throw new Error("VisionBoard requires MediaPipe libraries to function. They failed to load. Please check your internet connection and reload the page.");
        }

        setInitStatus("Configuring Hand Tracking...");
        const hands = new win.Hands({ 
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` 
        });

        hands.setOptions({ 
          maxNumHands: 1, 
          modelComplexity: 1, 
          minDetectionConfidence: 0.7, 
          minTrackingConfidence: 0.7 
        });

        hands.onResults((results: any) => {
          if (onResultsRef.current) onResultsRef.current(results);
        });

        setInitStatus("Starting Webcam...");
        const camera = new win.Camera(videoRef.current, {
          onFrame: async () => {
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
              try {
                await hands.send({ image: video });
              } catch (err) {
                // Non-critical frame error
              }
            }
          },
          width: 1280, 
          height: 720
        });

        await camera.start();
        setIsReady(true);
      } catch (err: any) {
        console.error("VisionBoard Init Error:", err);
        setErrorMessage(err.message || "Something went wrong during initialization.");
      }
    };

    initEngine();

    const handleResize = () => {
      const refs = [drawingCanvasRef, activeStrokeCanvasRef, canvasRef];
      refs.forEach(ref => {
        if (ref.current) {
          ref.current.width = window.innerWidth;
          ref.current.height = window.innerHeight;
        }
      });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      initializedRef.current = false;
    };
  }, []);

  return (
    <div className="relative w-full h-full cursor-none bg-slate-950 overflow-hidden">
      <video ref={videoRef} className="hidden" />
      
      <div className="absolute inset-0 z-0">
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1] opacity-30 blur-sm brightness-75" autoPlay muted playsInline />
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>

      <div className="absolute left-0 top-0 bottom-0 w-24 z-20 flex flex-col items-center justify-around py-32 bg-black/40 backdrop-blur-3xl border-r border-white/5">
        <div className="flex flex-col items-center gap-8">
          {COLOR_OPTIONS.map((opt) => (
            <div 
              key={opt.value}
              className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center relative
                ${color === opt.value ? 'border-white scale-125 shadow-[0_0_25px_rgba(255,255,255,0.4)]' : 'border-white/10 opacity-30'}
                ${hoverTarget?.value === opt.value ? 'opacity-100 ring-4 ring-white/20' : ''}`}
              style={{ backgroundColor: opt.value }}
            >
              {color === opt.value && <div className="absolute -right-12 w-2 h-2 rounded-full bg-white shadow-lg" />}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-0 top-0 bottom-0 w-24 z-20 flex flex-col items-center justify-around py-48 bg-black/40 backdrop-blur-3xl border-l border-white/5">
         <div className="flex flex-col items-center gap-12">
          {SIZE_OPTIONS.map((opt) => (
            <div 
              key={opt.value}
              className={`w-14 h-14 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-1
                ${brushSize === opt.value ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_25px_rgba(59,130,246,0.3)]' : 'border-white/5 opacity-30'}
                ${hoverTarget?.value === opt.value ? 'opacity-100 bg-white/5' : ''}`}
            >
              <div className="rounded-full bg-white" style={{ width: opt.value / 1.5, height: opt.value / 1.5 }} />
              <span className="text-[9px] font-black tracking-widest text-white/50">{opt.label[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {cursorPos && (
        <div 
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border-4 border-white/10 scale-90" />
             {selectionProgress > 0 && (
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="transparent"
                  stroke="white"
                  strokeWidth="4"
                  strokeDasharray={`${selectionProgress * 1.76} 176`}
                  className="transition-all duration-75"
                />
              </svg>
            )}
            <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_15px_white]" />
          </div>
          
          {hoverTarget && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black text-white whitespace-nowrap shadow-xl border border-white/10">
              LOCKING {hoverTarget.type.toUpperCase()}...
            </div>
          )}
        </div>
      )}

      <canvas ref={drawingCanvasRef} className="absolute inset-0 z-10 w-full h-full pointer-events-none" />
      <canvas ref={activeStrokeCanvasRef} className="absolute inset-0 z-20 w-full h-full pointer-events-none" />
      <canvas ref={canvasRef} className="absolute inset-0 z-30 w-full h-full pointer-events-none scale-x-[-1] opacity-40" />

      <div className="absolute right-32 bottom-32 z-40">
        <button 
          onClick={async () => {
            if (!drawingCanvasRef.current) return;
            setIsAnalyzing(true);
            try {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [
                  { text: "Examine this digital smartboard drawing. List any identified objects or symbols, and offer a short, sophisticated, witty critique of the artistic style." },
                  { inlineData: { mimeType: 'image/png', data: drawingCanvasRef.current.toDataURL('image/png').split(',')[1] } }
                ]}
              });
              setAiAnalysis(response.text);
            } catch (e) { 
              console.error("AI Analysis failed", e);
              setAiAnalysis("Vision Intelligence experienced a hiccup. Check your board and try again."); 
            }
            setIsAnalyzing(false);
          }}
          disabled={isAnalyzing}
          className="bg-blue-600 hover:bg-blue-500 w-20 h-20 rounded-[2rem] border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
        >
          {isAnalyzing ? (
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-3xl group-hover:rotate-12 transition-transform">✨</span>
          )}
        </button>
      </div>

      {aiAnalysis && (
        <div className="absolute bottom-56 right-32 z-50 max-w-sm bg-slate-900/90 backdrop-blur-3xl text-white p-8 rounded-[3rem] shadow-[0_25px_80px_rgba(0,0,0,0.8)] border border-white/10 animate-in zoom-in-95 slide-in-from-bottom-12">
          <button onClick={() => setAiAnalysis(null)} className="absolute -top-4 -right-4 bg-slate-800 text-white w-10 h-10 rounded-full font-black shadow-lg hover:bg-red-500 transition-colors border border-white/10">✕</button>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs">AI</div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Analysis Complete</span>
            </div>
            <p className="text-sm font-medium leading-relaxed italic text-slate-100">
              {aiAnalysis}
            </p>
          </div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-[100]">
          <div className="flex flex-col items-center gap-6 text-center px-10">
            {!errorMessage ? (
              <>
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-500/20 rounded-[2.5rem] animate-pulse" />
                  <div className="absolute inset-0 w-20 h-20 border-t-4 border-blue-500 rounded-[2.5rem] animate-spin" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-black text-white">Loading Workspace</h3>
                  <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.3em] animate-pulse">
                    {initStatus}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">⚠️</div>
                <h3 className="text-2xl font-black text-white">Engine Stalled</h3>
                <p className="text-red-400 font-medium max-w-sm">{errorMessage}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-all border border-white/5 uppercase tracking-widest text-xs"
                >
                  Restart VisionBoard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Smartboard;