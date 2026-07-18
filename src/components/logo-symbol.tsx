import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useAccent } from "../providers/accent-provider";

interface LogoSymbolProps {
  className?: string;
  isGenerating?: boolean;
}

export function LogoSymbol({ className = "w-9 h-9", isGenerating = false }: LogoSymbolProps) {
  const shouldReduceMotion = useReducedMotion();
  const { accentColor } = useAccent();
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Periodic 3°–5° rotational calibration every 25 seconds
  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setIsCalibrating(true);
      // Automatically return to normal after animation finishes
      setTimeout(() => {
        setIsCalibrating(false);
      }, 1800);
    }, 25000);

    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  // Dynamic glow color matching OMNISCRIPT's active brand accent color selection
  const glowGradient = {
    blue: "from-blue-500/35 to-blue-600/0",
    purple: "from-violet-500/35 to-violet-600/0",
    emerald: "from-emerald-500/35 to-emerald-600/0",
    orange: "from-orange-500/35 to-orange-600/0",
    rose: "from-rose-500/35 to-rose-600/0",
    cyan: "from-cyan-500/35 to-cyan-600/0"
  }[accentColor] || "from-emerald-500/35 to-emerald-600/0";

  return (
    /* Outer wrapper: Handles continuous float micro-motion, stationary during active AI generation */
    <motion.div
      className={`shrink-0 relative ${className}`}
      animate={shouldReduceMotion ? undefined : {
        y: isGenerating ? 0 : [0, -3.5, 0],
        rotate: isCalibrating && !isGenerating ? [0, 4.5, -4.5, 0] : 0,
      }}
      transition={shouldReduceMotion ? undefined : {
        y: isGenerating ? { duration: 0.4 } : {
          duration: 4.8,
          repeat: Infinity,
          ease: "easeInOut",
        },
        rotate: isCalibrating && !isGenerating ? {
          duration: 1.8,
          ease: "easeInOut"
        } : undefined
      }}
    >
      {/* Soft Emerald Activation Pulse Ring (exclusive to AI active generation) */}
      {isGenerating && !shouldReduceMotion && (
        <motion.div
          className="absolute -inset-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 blur-xs z-0 pointer-events-none"
          animate={{
            scale: [0.97, 1.05, 0.97],
            opacity: [0.35, 0.7, 0.35]
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {/* Inner wrapper: Handles hover scale, tilt, brightness with spring-based easing */}
      <motion.div
        className="relative w-full h-full select-none cursor-pointer"
        whileHover="hover"
        animate={isGenerating ? "generating" : "idle"}
        variants={{
          idle: { scale: 1 },
          generating: {
            scale: 1.02,
            transition: { duration: 0.3 }
          },
          hover: {
            scale: shouldReduceMotion ? 1.01 : 1.06,
            rotate: shouldReduceMotion ? 0 : -3.5,
            filter: "brightness(1.12)",
            transition: { type: "spring", stiffness: 350, damping: 20 }
          }
        }}
      >
        {/* Soft Premium Radial Glow (expanded / pulsed during active generation) */}
        <motion.div
          className={`absolute -inset-4 rounded-full blur-xl bg-gradient-to-br ${glowGradient} pointer-events-none z-0`}
          animate={isGenerating ? {
            opacity: [0.5, 0.8, 0.5],
            scale: [1.05, 1.25, 1.05]
          } : {
            opacity: 0
          }}
          transition={{
            duration: 2.0,
            repeat: isGenerating ? Infinity : 0,
            ease: "easeInOut"
          }}
          variants={{
            hover: { 
              opacity: 1, 
              scale: shouldReduceMotion ? 1.05 : 1.35,
              transition: { type: "spring", stiffness: 200, damping: 25 }
            }
          }}
        />

        {/* Outer Glow Ring (ambient background ring, brightens/widens during active generation) */}
        <motion.div 
          className="absolute inset-0 bg-zinc-950/20 dark:bg-white/20 rounded-xl blur-md opacity-75 dark:opacity-40 scale-105 z-0"
          animate={isGenerating ? {
            scale: 1.08,
            opacity: 0.75
          } : {}}
          variants={{
            hover: {
              scale: shouldReduceMotion ? 1.03 : 1.14,
              opacity: 0.6,
              transition: { duration: 0.3 }
            }
          }}
        />
        
        {/* Inner Metallic Container with dynamic borders */}
        <div className={`relative w-full h-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-lg transition-colors duration-500 overflow-hidden z-10 border ${
          isGenerating 
            ? "border-emerald-500/40 dark:border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
            : "border-zinc-800 dark:border-zinc-200"
        }`}>
          {/* Abstract Background Ribbon */}
          <div className="absolute inset-0 bg-linear-to-br from-zinc-800/40 via-transparent to-transparent dark:from-zinc-100 dark:via-transparent dark:to-transparent"></div>
          
          {/* Core Sparkles Symbol - slow mechanical calibration and gentle rotation */}
          <motion.div
            className="w-1/2 h-1/2 flex items-center justify-center z-10"
            animate={isGenerating && !shouldReduceMotion ? {
              rotate: [0, 15, -15, 0],
              scale: [1, 1.06, 0.94, 1]
            } : {
              rotate: 0,
              scale: 1
            }}
            transition={isGenerating && !shouldReduceMotion ? {
              rotate: {
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              },
              scale: {
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut"
              }
            } : { duration: 0.3 }}
          >
            <Sparkles className={`w-full h-full transition-colors duration-500 ${
              isGenerating ? "text-emerald-400 dark:text-emerald-500" : "text-white dark:text-zinc-950"
            }`} />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
