import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useAccent } from "../providers/accent-provider";
import { useUserSettings } from "../providers/settings-provider";

export function ThinkingSkeleton() {
  const { accentColor } = useAccent();
  const { settings } = useUserSettings();
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    "Preparing workspace...",
    "Drafting response...",
    "Formulating message...",
    "Reviewing format...",
    "Completing document..."
  ];

  // Disable dynamic animations if reduceMotion is active or smoothStreaming is disabled
  const shouldAnimate = !settings.reduceMotion && settings.smoothStreaming;

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const colorName = accentColor === "purple" ? "violet" : accentColor;

  return (
    <div className="flex flex-col gap-4 py-2 min-w-[280px] sm:min-w-[420px] select-none">
      
      {/* Top Header Row with Orbital Indicator and Refined Terminology */}
      <div className="flex items-center gap-3">
        {/* Orbital Motion Indicator (replaces traditional spinners) */}
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          
          {/* Outer Ring */}
          <motion.div
            className={`absolute inset-0 rounded-full border border-${colorName}-500/15`}
            animate={shouldAnimate ? { rotate: 360 } : undefined}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Middle Dashed Ring */}
          <motion.div
            className={`absolute inset-1 rounded-full border border-dashed border-${colorName}-500/35`}
            animate={shouldAnimate ? { rotate: -360 } : undefined}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Inner Ring with orbital particle */}
          <motion.div
            className={`absolute inset-2 rounded-full border border-${colorName}-500/10 flex items-center justify-center`}
            animate={shouldAnimate ? { rotate: 360 } : undefined}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {/* The Orbital Particle */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-${colorName}-500 shadow-[0_0_6px_var(--color-ring)]`} />
          </motion.div>

          {/* Core Pulsing Point */}
          <motion.div
            className={`w-2 h-2 rounded-full bg-${colorName}-500 shadow-[0_0_8px_var(--color-ring)]`}
            animate={shouldAnimate ? { scale: [1, 1.25, 1] } : undefined}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Status Language ticker */}
        <div className="flex flex-col text-left">
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest text-${colorName}-500 dark:text-${colorName}-400`}>
            OMNISCRIPT ACTIVE
          </span>
          <motion.span
            key={statuses[statusIndex]}
            initial={shouldAnimate ? { opacity: 0, y: 3 } : undefined}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldAnimate ? { opacity: 0, y: -3 } : undefined}
            transition={{ duration: 0.2 }}
            className="text-xs font-semibold text-foreground/80 font-display"
          >
            {statuses[statusIndex]}
          </motion.span>
        </div>
      </div>

      {/* Shimmering Line Waves representing active computation */}
      <div className="space-y-2.5 pl-11">
        <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-[85%] overflow-hidden relative">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r from-transparent via-${colorName}-500/10 to-transparent`}
            animate={shouldAnimate ? { x: ["-100%", "100%"] } : undefined}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="h-2.5 bg-zinc-200/70 dark:bg-zinc-800/80 rounded-md w-[95%] overflow-hidden relative">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r from-transparent via-${colorName}-500/10 to-transparent`}
            animate={shouldAnimate ? { x: ["-100%", "100%"] } : undefined}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </div>
        <div className="h-2.5 bg-zinc-200/40 dark:bg-zinc-800/60 rounded-md w-[65%] overflow-hidden relative">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r from-transparent via-${colorName}-500/10 to-transparent`}
            animate={shouldAnimate ? { x: ["-100%", "100%"] } : undefined}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
        </div>
      </div>

      {/* Clean User Workspace block */}
      <div className="mt-1.5 ml-11 p-3.5 rounded-xl bg-zinc-950/5 dark:bg-zinc-950/20 border border-border/35 space-y-2 relative overflow-hidden text-left">
        <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground/60 border-b border-border/20 pb-1.5 mb-1.5">
          <span>SECURE WORKSPACE SESSION</span>
          <span className={`text-${colorName}-500/70`}>PROTECTED</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-1.5 w-[45%] bg-zinc-300/30 dark:bg-zinc-800 rounded-xs" />
          <div className="h-1.5 w-[75%] bg-zinc-300/20 dark:bg-zinc-800/70 rounded-xs" />
          <div className="h-1.5 w-[55%] bg-zinc-300/20 dark:bg-zinc-800/50 rounded-xs" />
        </div>
        {/* Sweeping radar scanlight effect */}
        <motion.div
          className={`absolute top-0 bottom-0 w-1 bg-gradient-to-r from-transparent via-${colorName}-500/10 to-transparent`}
          animate={shouldAnimate ? { x: ["-20%", "450px"] } : undefined}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
