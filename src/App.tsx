/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Waves, 
  Info, 
  Play, 
  RotateCcw,
  ArrowRight
} from 'lucide-react';

// --- Constants & Types ---

type Tab = 'taylor' | 'elements' | 'types';

interface Pulse {
  x: number;
  amplitude: number;
  width: number;
  velocity: number;
  direction: 1 | -1;
  inverted: boolean;
  active: boolean;
  isReflected?: boolean;
}

// --- Components ---

const TabButton = ({ 
  active, 
  onClick, 
  icon: Icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string 
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all border-b-2 ${
      active 
        ? 'border-orange-500 text-orange-500 bg-orange-500/5' 
        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

const Slider = ({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  unit, 
  onChange 
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step: number; 
  unit: string; 
  onChange: (val: number) => void 
}) => (
  <div className="flex flex-col gap-2 mb-4">
    <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-wider text-zinc-500">
      <span>{label}</span>
      <span className="text-orange-400">{value.toFixed(2)} {unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('taylor');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(0);

  // Simulation State
  const [isRunning, setIsRunning] = useState(false);
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Taylor's Law State
  const [tension] = useState(100); // N
  const [density] = useState(0.05); // kg/m
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showLambda, setShowLambda] = useState(true);
  const [showAmplitude, setShowAmplitude] = useState(true);
  const [pulses, setPulses] = useState<Pulse[]>([]);

  // Derived Values
  const velocity = Math.sqrt(tension / density);

  const resetSimulation = () => {
    setPulses([]);
    setIsRunning(false);
    setSpeedMultiplier(1);
    setShowLambda(true);
    setShowAmplitude(true);
    if (waveIntervalRef.current) {
      clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = null;
    }
  };

  const stopWave = () => {
    if (waveIntervalRef.current) {
      clearInterval(waveIntervalRef.current);
      waveIntervalRef.current = null;
    }
  };

  const spawnWave = () => {
    stopWave();
    setIsRunning(true);
    let count = 0;
    const generate = () => {
      spawnPulse(count % 2 === 1);
      count++;
    };
    generate();
    waveIntervalRef.current = setInterval(generate, 350); 
  };

  useEffect(() => {
    if (activeTab === 'elements') {
      setTimeout(() => {
        spawnWave();
      }, 500);
    }
  }, [activeTab]);

  const spawnPulse = (forceInvertedParam?: any) => {
    // If called from onClick directly, forceInvertedParam will be an event object.
    // We want a boolean.
    let forceInverted = typeof forceInvertedParam === 'boolean' ? forceInvertedParam : false;

    // Specially for 'types' tab, user requested it to be a crest (not inverted)
    if (activeTab === 'types') {
      forceInverted = false;
    }

    const newPulse: Pulse = {
      x: -60, // Start off-screen for a "entering" effect
      amplitude: 40,
      width: 30, // Optimized fixed width
      velocity: velocity,
      direction: 1,
      inverted: forceInverted ?? false,
      active: true
    };
    setPulses(prev => [...prev, newPulse]);
    setIsRunning(true);
  };

  const updateSimulation = useCallback((time: number) => {
    if (!isRunning) {
      startTimeRef.current = 0;
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = time;
      requestRef.current = requestAnimationFrame(updateSimulation);
      return;
    }

    const deltaTime = Math.min((time - startTimeRef.current) / 1000, 0.05); // Cap deltaTime to avoid jumps
    startTimeRef.current = time;

    setPulses(prev => {
      const updated = prev.map(p => {
        if (!p.active) return p;
        
        // Reduced scaling factor for even better visibility (didactic speed)
        let nextX = p.x + p.velocity * speedMultiplier * p.direction * deltaTime * 12; 
        let nextDirection = p.direction;
        let nextInverted = p.inverted;
        let nextVelocity = p.velocity;
        let nextActive = p.active;
        let nextIsReflected = p.isReflected;

        const canvasWidth = canvasRef.current?.width || 800;
        const padding = 100;
        const simWidth = canvasWidth - 2 * padding;

        // Taylor's Law / Elements Logic (Simple propagation)
        if (activeTab === 'taylor' || activeTab === 'elements') {
          if (nextX > simWidth + 50) nextActive = false;
        }

        return { ...p, x: nextX, direction: nextDirection, inverted: nextInverted, active: nextActive, velocity: nextVelocity, isReflected: nextIsReflected };
      });

      return updated.filter(p => p.active);
    });

    requestRef.current = requestAnimationFrame(updateSimulation);
  }, [isRunning, activeTab, velocity, speedMultiplier]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;
    const points = 400;
    const padding = 100; // Increased padding to keep arrows and labels fully on screen
    const simWidth = w - 2 * padding;

    ctx.clearRect(0, 0, w, h);

    // Helper to draw an arrow
    const drawArrow = (x: number, y: number, length: number, angle: number, color: string, label?: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      
      // Arrow head
      const headSize = 8 * Math.sign(length);
      ctx.beginPath();
      ctx.moveTo(length, 0);
      ctx.lineTo(length - headSize, -5);
      ctx.lineTo(length - headSize, 5);
      ctx.fill();

      if (label) {
        ctx.rotate(-angle);
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Position label relative to the arrow's direction
        const labelX = (length / 2) * Math.cos(angle);
        const labelY = (length / 2) * Math.sin(angle) - 15;
        ctx.fillText(label, labelX, labelY);
      }
      ctx.restore();
    };

    // Draw Background Grid
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 0; i < h; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }

    // Draw Physical Values on Canvas
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

    if (activeTab === 'types') {
      // --- DUAL VISUALIZATION ---
      const transversalCenterY = centerY - 80;
      const longitudinalCenterY = centerY + 80;

      // Labels
      ctx.font = 'bold 10px font-mono';
      ctx.fillStyle = '#f97316';
      ctx.fillText('ONDA TRANSVERSAL (CORDA)', padding, transversalCenterY - 60);
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('ONDA LONGITUDINAL (MOLA)', padding, longitudinalCenterY - 60);

      // 1. Draw Transversal String
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = padding + (i / points) * simWidth;
        let yOffset = 0;
        pulses.forEach(p => {
          const dist = Math.abs(x - (padding + p.x));
          if (dist < p.width * 4) {
            const val = p.amplitude * Math.exp(-Math.pow(dist / p.width, 2));
            yOffset += p.inverted ? -val : val;
          }
        });
        if (i === 0) ctx.moveTo(x, transversalCenterY - yOffset);
        else ctx.lineTo(x, transversalCenterY - yOffset);
      }
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Longitudinal Spring
      const coils = 60;
      for (let i = 0; i <= coils; i++) {
        const baseX = padding + (i / coils) * simWidth;
        let xOffset = 0;
        pulses.forEach(p => {
          const dist = Math.abs(baseX - (padding + p.x));
          if (dist < p.width * 4) {
            // Longitudinal displacement is horizontal
            const val = p.amplitude * 1.5 * Math.exp(-Math.pow(dist / p.width, 2));
            xOffset += p.inverted ? -val : val;
          }
        });

        const coilX = baseX + xOffset;
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.moveTo(coilX, longitudinalCenterY - 20);
        ctx.lineTo(coilX, longitudinalCenterY + 20);
        ctx.stroke();
      }
      
      // Connecting lines for spring (aesthetic)
      ctx.beginPath();
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.moveTo(padding, longitudinalCenterY);
      ctx.lineTo(w - padding, longitudinalCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

    } else {
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = padding + (i / points) * simWidth;
        let yOffset = 0;
        pulses.forEach(p => {
          const dist = Math.abs(x - (padding + p.x));
          if (dist < p.width * 4) {
            const val = p.amplitude * Math.exp(-Math.pow(dist / p.width, 2));
            yOffset += p.inverted ? -val : val;
          }
        });
        
        if (i === 0) ctx.moveTo(x, centerY - yOffset);
        else ctx.lineTo(x, centerY - yOffset);
      }
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1 + density * 80; // Thickness based on density
      ctx.stroke();

      // --- Wave Element Annotations (Cristas, Vales, λ, A) ---
      if (activeTab === 'elements') {
        const simPoints: { x: number, y: number }[] = [];
        for (let i = 0; i <= points; i++) {
          const x = padding + (i / points) * simWidth;
          let yOffset = 0;
          pulses.forEach(p => {
            const dist = Math.abs(x - (padding + p.x));
            if (dist < p.width * 4) {
              const val = p.amplitude * Math.exp(-Math.pow(dist / p.width, 2));
              yOffset += p.inverted ? -val : val;
            }
          });
          simPoints.push({ x, y: centerY - yOffset });
        }

        // Find Crests and Troughs
        const crests: { x: number, y: number }[] = [];
        const troughs: { x: number, y: number }[] = [];
        const threshold = 5;

        for (let i = 1; i < simPoints.length - 1; i++) {
          const prev = simPoints[i - 1].y;
          const curr = simPoints[i].y;
          const next = simPoints[i + 1].y;

          // Local Minimum in Y (Highest point / Crest)
          if (curr < prev && curr < next && (centerY - curr) > threshold) {
            crests.push(simPoints[i]);
          }
          // Local Maximum in Y (Lowest point / Trough)
          if (curr > prev && curr > next && (curr - centerY) > threshold) {
            troughs.push(simPoints[i]);
          }
        }

        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';

        // Draw Amplitude Annotations
        if (showAmplitude) {
          // Crest Amplitude
          if (crests.length > 0) {
            const c = crests[0];
            ctx.beginPath();
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.moveTo(c.x, centerY);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#fff';
            ctx.fillText('A (Amplitude)', c.x, (c.y + centerY) / 2);
          }
          // Trough Amplitude
          if (troughs.length > 0) {
            const t = troughs[0];
            ctx.beginPath();
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.moveTo(t.x, centerY);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#fff';
            ctx.fillText('A (Amplitude)', t.x, (t.y + centerY) / 2);
          }
        }

        // Draw Wavelength (λ) between first and second crest
        if (showLambda && crests.length >= 2) {
          const c1 = crests[0];
          const c2 = crests[1];
          const lambdaY = Math.min(c1.y, c2.y) - 30;
          
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.5;
          ctx.moveTo(c1.x, lambdaY);
          ctx.lineTo(c2.x, lambdaY);
          ctx.stroke();

          // λ Symbols at ends
          ctx.beginPath();
          ctx.moveTo(c1.x, lambdaY - 5);
          ctx.lineTo(c1.x, lambdaY + 5);
          ctx.moveTo(c2.x, lambdaY - 5);
          ctx.lineTo(c2.x, lambdaY + 5);
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.fillText('λ (Comprimento de Onda)', (c1.x + c2.x) / 2, lambdaY - 5);
        }

        // Draw Wavelength (λ) between first and second trough
        if (showLambda && troughs.length >= 2) {
          const t1 = troughs[0];
          const t2 = troughs[1];
          const lambdaY = Math.max(t1.y, t2.y) + 30;
          
          ctx.beginPath();
          ctx.strokeStyle = '#3b82f6'; // Blue for trough-to-trough
          ctx.lineWidth = 1.5;
          ctx.moveTo(t1.x, lambdaY);
          ctx.lineTo(t2.x, lambdaY);
          ctx.stroke();

          // λ Symbols at ends
          ctx.beginPath();
          ctx.moveTo(t1.x, lambdaY - 5);
          ctx.lineTo(t1.x, lambdaY + 5);
          ctx.moveTo(t2.x, lambdaY - 5);
          ctx.lineTo(t2.x, lambdaY + 5);
          ctx.stroke();

          ctx.fillStyle = '#3b82f6';
          ctx.fillText('λ (Comprimento de Onda)', (t1.x + t2.x) / 2, lambdaY + 15);
        }

        // Label Crests and Troughs
        ctx.fillStyle = '#fff';
        crests.forEach(c => {
          ctx.fillText('CRISTA', c.x, c.y - 10);
          ctx.beginPath();
          ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        troughs.forEach(t => {
          ctx.fillText('VALE', t.x, t.y + 15);
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Draw Velocity Vectors on Pulses
    pulses.forEach(p => {
      const screenX = padding + p.x;
      if (screenX > padding && screenX < w - padding) {
        let arrowY = centerY - (p.inverted ? -p.amplitude - 20 : p.amplitude + 20);
        
        if (activeTab === 'types') {
          // Put arrow above the transversal string
          arrowY = (centerY - 80) - (p.inverted ? -p.amplitude - 20 : p.amplitude + 20);
        }

        const arrowLen = 30 + (p.velocity / 10); 
        
        let arrowColor = '#22c55e'; // Default green
        
        drawArrow(screenX, arrowY, arrowLen * p.direction, 0, arrowColor, '');
      }
    });

    // Draw End Supports
    ctx.fillStyle = '#333';
    
    if (activeTab === 'types') {
      const tY = centerY - 80;
      const lY = centerY + 80;
      // Transversal supports
      ctx.fillRect(padding - 4, tY - 20, 4, 40);
      ctx.fillRect(w - padding, tY - 20, 4, 40);
      // Longitudinal supports
      ctx.fillRect(padding - 4, lY - 20, 4, 40);
      ctx.fillRect(w - padding, lY - 20, 4, 40);
    } else {
      // Left support
      ctx.fillRect(padding - 4, centerY - 20, 4, 40);
      
      // Right support
      ctx.fillRect(w - padding, centerY - 20, 4, 40);
    }

  }, [pulses, activeTab, tension, density, velocity, speedMultiplier, showLambda, showAmplitude]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateSimulation);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    };
  }, [updateSimulation]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Waves className="text-orange-500" size={24} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase text-white">Ondas Introdução - Prof. Grossi</h1>
          </div>
        </div>
        
        <nav className="flex">
          <TabButton 
            active={activeTab === 'taylor'} 
            onClick={() => { setActiveTab('taylor'); resetSimulation(); }} 
            icon={Activity} 
            label="Onda e Pulso" 
          />
          <TabButton 
            active={activeTab === 'types'} 
            onClick={() => { setActiveTab('types'); resetSimulation(); }} 
            icon={ArrowRight} 
            label="Transversal e Longitudinal" 
          />
          <TabButton 
            active={activeTab === 'elements'} 
            onClick={() => { setActiveTab('elements'); resetSimulation(); }} 
            icon={Activity} 
            label="Elementos Importantes" 
          />
        </nav>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] overflow-hidden">
        {/* Simulation Area */}
        <div className="relative flex flex-col p-8 bg-[#0e0e0e] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div 
              key="sim-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 relative bg-black/40 rounded-2xl border border-zinc-800/50 shadow-2xl overflow-hidden flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={400} 
              className="w-full h-full max-w-4xl cursor-crosshair"
            />
            
            {/* Overlay Info */}
            <div className="absolute top-6 left-6 flex flex-col gap-2">
              <AnimatePresence>
                {/* Velocity overlay removed per user request */}
              </AnimatePresence>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-8 flex gap-4">
              { activeTab !== 'elements' && (
                <button 
                  onClick={() => spawnPulse()}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold text-sm transition-all border border-zinc-700 active:scale-95 shadow-lg"
                >
                  <Play size={18} fill="currentColor" />
                  GERAR PULSO
                </button>
              )}
              
              { (activeTab === 'taylor' || activeTab === 'elements') && (
                <button 
                  onClick={spawnWave}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                >
                  <Waves size={18} />
                  GERAR ONDA
                </button>
              )}

              <button 
                onClick={resetSimulation}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-all border border-zinc-700"
                title="Resetar"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>

        </motion.div>
      </AnimatePresence>
    </div>

        {/* Sidebar Controls */}
        <aside className="border-l border-zinc-800 bg-zinc-900/30 p-8 flex flex-col gap-8 overflow-y-auto">
          <section>
            {activeTab === 'elements' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  <Info size={16} className="text-orange-500" />
                  Elementos da Onda
                </div>

                <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 space-y-4">
                   <Slider
                     label="Velocidade de Propagação"
                     value={speedMultiplier}
                     min={0.2}
                     max={2.5}
                     step={0.1}
                     unit="x"
                     onChange={setSpeedMultiplier}
                   />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowLambda(!showLambda)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                      showLambda 
                        ? 'bg-green-500/10 border-green-500 text-green-400' 
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                    }`}
                  >
                    {showLambda ? 'Visível λ' : 'Oculto λ'}
                  </button>
                  <button
                    onClick={() => setShowAmplitude(!showAmplitude)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                      showAmplitude 
                        ? 'bg-orange-500/10 border-orange-500 text-orange-400' 
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                    }`}
                  >
                    {showAmplitude ? 'Visível A' : 'Oculto A'}
                  </button>
                </div>

                <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800">
                   <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                     Observe as marcações no simulador: Cristas (pontos altos), Vales (pontos bajos), Amplitude (A) e o Comprimento de Onda (λ).
                   </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'types' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  <Info size={16} className="text-orange-500" />
                  Observação Didática
                </div>
                <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info size={16} /> Comparação de Ondas
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase">Onda Transversal</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        A vibração ocorre de forma <span className="text-orange-500 font-bold">perpendicular</span> à direção de propagación. (Ex: Corda, Luz)
                      </p>
                    </div>
                    <div className="h-px bg-zinc-800" />
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase">Onda Longitudinal</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        A vibração ocorre na <span className="text-blue-500 font-bold">mesma direção</span> da propagação. (Ex: Mola, Som)
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800">
                   <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                     Observe o comportamento das partículas (Corda) vs o movimento das espiras (Mola).
                   </p>
                </div>
              </motion.div>
            )}
          </section>

          <footer className="mt-auto pt-8 border-t border-zinc-800">
            <div className="flex items-center gap-3 text-zinc-600">
              <Activity size={14} />
              <span className="text-[9px] font-mono uppercase tracking-[0.3em]">Physics Engine v1.0.4</span>
            </div>
          </footer>
        </aside>
      </main>
    </div>
  );
}
