import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type AccentColor = "blue" | "purple" | "emerald" | "orange" | "rose" | "cyan";

export interface AccentClasses {
  bg: string;
  hoverBg: string;
  text: string;
  border: string;
  ring: string;
  focusBorder: string;
  accentBg: string;
  accentHover: string;
  activeHighlight: string;
  dot: string;
}

interface AccentContextType {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  classes: AccentClasses;
}

const AccentContext = createContext<AccentContextType | undefined>(undefined);

const accentClassesMap: Record<AccentColor, AccentClasses> = {
  blue: {
    bg: "bg-blue-600 dark:bg-blue-500 text-white",
    hoverBg: "hover:bg-blue-700 dark:hover:bg-blue-600",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-600/20 dark:border-blue-500/20",
    ring: "focus-within:ring-blue-500/20 focus:ring-blue-500/20",
    focusBorder: "focus-within:border-blue-500 focus:border-blue-500",
    accentBg: "bg-blue-50 dark:bg-blue-950/20",
    accentHover: "hover:bg-blue-50/80 dark:hover:bg-blue-950/10",
    activeHighlight: "bg-blue-50/80 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-medium",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  purple: {
    bg: "bg-violet-600 dark:bg-violet-500 text-white",
    hoverBg: "hover:bg-violet-700 dark:hover:bg-violet-600",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-600/20 dark:border-violet-500/20",
    ring: "focus-within:ring-violet-500/20 focus:ring-violet-500/20",
    focusBorder: "focus-within:border-violet-500 focus:border-violet-500",
    accentBg: "bg-violet-50 dark:bg-violet-950/20",
    accentHover: "hover:bg-violet-50/80 dark:hover:bg-violet-950/10",
    activeHighlight: "bg-violet-50/80 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 font-medium",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
  emerald: {
    bg: "bg-emerald-600 dark:bg-emerald-500 text-white",
    hoverBg: "hover:bg-emerald-700 dark:hover:bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-600/20 dark:border-emerald-500/20",
    ring: "focus-within:ring-emerald-500/20 focus:ring-emerald-500/20",
    focusBorder: "focus-within:border-emerald-500 focus:border-emerald-500",
    accentBg: "bg-emerald-50 dark:bg-emerald-950/20",
    accentHover: "hover:bg-emerald-50/80 dark:hover:bg-emerald-950/10",
    activeHighlight: "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-medium",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  orange: {
    bg: "bg-orange-600 dark:bg-orange-500 text-white",
    hoverBg: "hover:bg-orange-700 dark:hover:bg-orange-600",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-600/20 dark:border-orange-500/20",
    ring: "focus-within:ring-orange-500/20 focus:ring-orange-500/20",
    focusBorder: "focus-within:border-orange-500 focus:border-orange-500",
    accentBg: "bg-orange-50 dark:bg-orange-950/20",
    accentHover: "hover:bg-orange-50/80 dark:hover:bg-orange-950/10",
    activeHighlight: "bg-orange-50/80 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 font-medium",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  rose: {
    bg: "bg-rose-600 dark:bg-rose-500 text-white",
    hoverBg: "hover:bg-rose-700 dark:hover:bg-rose-600",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-600/20 dark:border-rose-500/20",
    ring: "focus-within:ring-rose-500/20 focus:ring-rose-500/20",
    focusBorder: "focus-within:border-rose-500 focus:border-rose-500",
    accentBg: "bg-rose-50 dark:bg-rose-950/20",
    accentHover: "hover:bg-rose-50/80 dark:hover:bg-rose-950/10",
    activeHighlight: "bg-rose-50/80 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-medium",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  cyan: {
    bg: "bg-cyan-600 dark:bg-cyan-500 text-white",
    hoverBg: "hover:bg-cyan-700 dark:hover:bg-cyan-600",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-600/20 dark:border-cyan-500/20",
    ring: "focus-within:ring-cyan-500/20 focus:ring-cyan-500/20",
    focusBorder: "focus-within:border-cyan-500 focus:border-cyan-500",
    accentBg: "bg-cyan-50 dark:bg-cyan-950/20",
    accentHover: "hover:bg-cyan-50/80 dark:hover:bg-cyan-950/10",
    activeHighlight: "bg-cyan-50/80 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-400 font-medium",
    dot: "bg-cyan-500 dark:bg-cyan-400",
  },
};

interface AccentProviderProps {
  children: ReactNode;
}

export function AccentProvider({ children }: AccentProviderProps) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omniscript-accent") as AccentColor;
      return saved || "emerald";
    }
    return "emerald";
  });

  const setAccentColor = (newColor: AccentColor) => {
    setAccentColorState(newColor);
    localStorage.setItem("omniscript-accent", newColor);
  };

  // Dynamically update primary colors or selection outlines if needed on documents
  useEffect(() => {
    const root = window.document.documentElement;
    // Map colors to hex values for full-theme custom style property injects if required
    const hexColors: Record<AccentColor, string> = {
      blue: "#2563eb",
      purple: "#8b5cf6",
      emerald: "#10b981",
      orange: "#f97316",
      rose: "#f43f5e",
      cyan: "#06b6d4"
    };
    root.style.setProperty("--color-ring", hexColors[accentColor]);
  }, [accentColor]);

  return (
    <AccentContext.Provider
      value={{
        accentColor,
        setAccentColor,
        classes: accentClassesMap[accentColor],
      }}
    >
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  const context = useContext(AccentContext);
  if (!context) {
    throw new Error("useAccent must be used within an AccentProvider");
  }
  return context;
}
