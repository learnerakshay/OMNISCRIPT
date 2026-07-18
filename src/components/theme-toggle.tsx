import { useTheme, Theme } from "@/providers/theme-provider";
import { Sun, Moon, Monitor, Check, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ThemeToggleProps {
  isCollapsed?: boolean;
}

export function ThemeToggle({ isCollapsed = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className={isCollapsed ? "relative" : "relative w-full"} ref={containerRef}>
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center p-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
          title="Change theme"
          aria-label="Change theme"
        >
          <AnimatePresence mode="wait">
            {resolvedTheme === "light" ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Sun className="w-4 h-4 text-zinc-700" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Moon className="w-4 h-4 text-zinc-300" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-all duration-200 shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring text-xs font-medium"
          title="Change theme selection"
          aria-label="Change theme selection"
        >
          <div className="flex items-center gap-2">
            {resolvedTheme === "light" ? (
              <Sun className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span className="font-semibold text-foreground/90">Theme</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
              {theme}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-50 rounded-xl border border-border bg-popover p-1 shadow-md text-foreground mb-2 bottom-full ${
              isCollapsed ? "right-0 w-32" : "left-0 w-full"
            }`}
          >
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                    isSelected 
                      ? "bg-accent text-accent-foreground font-semibold" 
                      : "hover:bg-zinc-100 dark:hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-foreground shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

