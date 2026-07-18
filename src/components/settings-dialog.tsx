import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Sparkles, 
  Check, 
  Palette, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Sun, 
  Moon, 
  MessageSquare, 
  Accessibility as AccessibilityIcon, 
  Keyboard, 
  Eye, 
  ShieldAlert,
  Sliders,
  FileText,
  Lock,
  ExternalLink
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useAccent, AccentColor } from "../providers/accent-provider";
import { useTheme, Theme } from "../providers/theme-provider";
import { useUserSettings, UserSettings } from "../providers/settings-provider";
import { useToast } from "../providers/toast-provider";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "appearance" | "chat" | "accessibility" | "shortcuts" | "about";

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor, classes } = useAccent();
  const { settings, updateSetting, resetSettings } = useUserSettings();
  const { toast } = useToast();

  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("omniscript-sounds-enabled") === "true";
    }
    return false;
  });

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleToggleSounds = () => {
    const nextVal = !soundsEnabled;
    setSoundsEnabled(nextVal);
    localStorage.setItem("omniscript-sounds-enabled", String(nextVal));
    toast({
      title: nextVal ? "Haptic Sounds Enabled" : "Audio Muted",
      description: nextVal 
        ? "Sound feedback will trigger during system interactions." 
        : "Sound feedback has been disabled.",
      variant: "success"
    });
  };

  const handleAccentChange = (color: AccentColor) => {
    setAccentColor(color);
    toast({
      title: "Accent Color Updated",
      description: `Active interface accent set to ${color.toUpperCase()}.`,
      variant: "success",
    });
  };

  const colors: { id: AccentColor; name: string; bgClass: string }[] = [
    { id: "blue", name: "Ocean Blue", bgClass: "bg-blue-500" },
    { id: "purple", name: "Royal Purple", bgClass: "bg-violet-500" },
    { id: "emerald", name: "Forest Emerald", bgClass: "bg-emerald-500" },
    { id: "orange", name: "Sunset Orange", bgClass: "bg-orange-500" },
    { id: "rose", name: "Crimson Rose", bgClass: "bg-rose-500" },
    { id: "cyan", name: "Nordic Cyan", bgClass: "bg-cyan-500" },
  ];

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "appearance", label: "Appearance", icon: Eye },
    { id: "chat", label: "Chat Experience", icon: MessageSquare },
    { id: "accessibility", label: "Accessibility", icon: AccessibilityIcon },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
    { id: "about", label: "About", icon: Sparkles },
  ];

  const handleToggleSetting = (key: keyof UserSettings, name: string) => {
    const newVal = !settings[key];
    updateSetting(key, newVal);
    toast({
      title: `${name} ${newVal ? "Enabled" : "Disabled"}`,
      description: `Your preference has been saved and applied.`,
      variant: "success"
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-3xl h-[600px] bg-card text-foreground border border-border rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-border flex items-center justify-between bg-zinc-50 dark:bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-muted-foreground" />
                <h2 id="settings-title" className="font-display font-semibold text-base text-foreground">
                  OMNISCRIPT Settings
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split Sidebar & Content Workspace */}
            <div className="flex-1 flex min-h-0">
              {/* Vertical Tab Sidebar */}
              <div className="w-56 border-r border-zinc-200 dark:border-border bg-zinc-50/50 dark:bg-muted/10 p-3 flex flex-col justify-between shrink-0">
                <div className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                          isActive 
                            ? `${classes.accentBg} ${classes.text} border border-border/40 font-semibold shadow-xs` 
                            : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
                        }`}
                        type="button"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reset Buttons */}
                <div className="pt-4 border-t border-border/80 px-2">
                  <button
                    onClick={() => {
                      resetSettings();
                      setTheme("system");
                      setAccentColor("emerald");
                      toast({
                        title: "Settings Restored",
                        description: "All interface preferences have been reset to default values.",
                        variant: "success"
                      });
                    }}
                    className="w-full text-center text-[10px] font-semibold text-muted-foreground hover:text-destructive hover:underline tracking-wide uppercase transition-colors py-1 cursor-pointer"
                  >
                    Reset All Defaults
                  </button>
                </div>
              </div>

              {/* Dynamic Settings Content Frame */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-6"
                  >
                    {/* APPEARANCE TAB */}
                    {activeTab === "appearance" && (
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Theme Mode</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Customize the visual mode of OMNISCRIPT.</p>
                          
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            {(["light", "dark", "system"] as Theme[]).map((t) => {
                              const isSelected = theme === t;
                              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
                              return (
                                <button
                                  key={t}
                                  onClick={() => setTheme(t)}
                                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                                    isSelected 
                                      ? "bg-card border-foreground/30 ring-2 ring-ring/5 text-foreground font-semibold" 
                                      : "border-zinc-200 dark:border-border bg-zinc-50 dark:bg-muted/10 text-muted-foreground hover:bg-card hover:text-foreground"
                                  }`}
                                  type="button"
                                >
                                  <Icon className="w-4 h-4" />
                                  <span className="text-[11px] capitalize">{t}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border-t border-border/60 pt-4">
                          <h3 className="text-sm font-semibold text-foreground">Brand Accent Color</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Define focal highlights, buttons, and system indicators.</p>
                          
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
                            {colors.map((color) => {
                              const isSelected = accentColor === color.id;
                              return (
                                <button
                                  key={color.id}
                                  onClick={() => handleAccentChange(color.id)}
                                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer relative group ${
                                    isSelected 
                                      ? "bg-card border-foreground/30 shadow-xs ring-2 ring-ring/5" 
                                      : "border-transparent hover:bg-zinc-100/60 dark:hover:bg-card/50"
                                  }`}
                                  title={`Select ${color.name}`}
                                  type="button"
                                >
                                  <div className={`w-6 h-6 rounded-full ${color.bgClass} flex items-center justify-center relative shadow-inner group-hover:scale-105 active:scale-95 transition-transform`}>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                                    )}
                                  </div>
                                  <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground text-center truncate w-full capitalize">
                                    {color.id}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border-t border-border/60 pt-4 space-y-4">
                          <h3 className="text-sm font-semibold text-foreground">Interactive Effects</h3>
                          
                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Interface Audio</p>
                              <p className="text-muted-foreground leading-normal max-w-[340px]">
                                Play acoustic chimes and ticks upon system activations and composer clicks.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleToggleSounds}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                soundsEnabled ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={soundsEnabled}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  soundsEnabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Interface Animations</p>
                              <p className="text-muted-foreground leading-normal max-w-[340px]">
                                Enable fluent layout transitions, fades, and modal entries.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("reduceMotion", "Animations")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                                !settings.reduceMotion ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={!settings.reduceMotion}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  !settings.reduceMotion ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CHAT EXPERIENCE TAB */}
                    {activeTab === "chat" && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Chat Experience</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Tailor message delivery and composer behavior.</p>
                        </div>

                        <div className="space-y-3 mt-3">
                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Enter to Send</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Press Enter in composer to immediately send. Shift + Enter begins a new line.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("enterToSend", "Enter to Send")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.enterToSend ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.enterToSend}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.enterToSend ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Auto Scroll</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Automatically scroll window to bottom during real-time streaming content.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("autoScroll", "Auto Scroll")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.autoScroll ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.autoScroll}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.autoScroll ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Show Timestamps</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Display message recording times inside active conversation history.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("showTimestamps", "Show Timestamps")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.showTimestamps ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.showTimestamps}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.showTimestamps ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Smooth Streaming Animation</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Display micro-animations and status meters while loading.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("smoothStreaming", "Smooth Streaming")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.smoothStreaming ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.smoothStreaming}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.smoothStreaming ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Remember Last Conversation</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Re-open and activate your last active session automatically upon page reloading.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("rememberLastConversation", "Remember Last Session")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.rememberLastConversation ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.rememberLastConversation}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.rememberLastConversation ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACCESSIBILITY TAB */}
                    {activeTab === "accessibility" && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Accessibility Aids</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Adjust visibility controls for comfortable interactions.</p>
                        </div>

                        <div className="space-y-3 mt-3">
                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Reduce Motion</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Suppress energetic micro-animations and quick transitions.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("reduceMotion", "Reduced Motion")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.reduceMotion ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.reduceMotion}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.reduceMotion ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">High Contrast Mode</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Elevate outline thresholds and dark-light borders.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("highContrast", "High Contrast Mode")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.highContrast ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.highContrast}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.highContrast ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Visual Focus Indicators</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Outline keyboard-focused elements with thick colored highlights.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("focusIndicators", "Focus Indicators")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.focusIndicators ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.focusIndicators}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.focusIndicators ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-border/80 bg-zinc-50/80 dark:bg-muted/10">
                            <div className="text-xs space-y-0.5">
                              <p className="font-semibold text-foreground">Keyboard Interactive Navigation</p>
                              <p className="text-muted-foreground max-w-[340px] leading-normal">
                                Support keyboard shortcuts and interactive dialog escapes.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSetting("keyboardNavigation", "Keyboard Navigation")}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring ${
                                settings.keyboardNavigation ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                              }`}
                              role="switch"
                              aria-checked={settings.keyboardNavigation}
                            >
                              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${settings.keyboardNavigation ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* KEYBOARD SHORTCUTS TAB */}
                    {activeTab === "shortcuts" && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Quickly trigger core functions using command bindings.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 mt-3">
                          {[
                            { keys: ["Enter"], desc: "Send active message inside the composer" },
                            { keys: ["Shift", "Enter"], desc: "Insert a new line inside active message composer" },
                            { keys: ["Ctrl / ⌘", "K"], desc: "Instantly focus keyboard context onto composer" },
                            { keys: ["Ctrl / ⌘", "B"], desc: "Toggle visual collapsible navigation sidebar" },
                            { keys: ["Esc"], desc: "Dismiss settings panels and active overlay dialogs" },
                          ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200/80 dark:border-border/60 bg-zinc-50/80 dark:bg-muted/10">
                              <span className="text-xs text-muted-foreground">{item.desc}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.keys.map((k, ki) => (
                                  <span key={ki} className="px-2 py-1 rounded-md border border-border/80 bg-card text-[10px] font-semibold font-mono text-foreground/80 shadow-2xs">
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ABOUT TAB */}
                    {activeTab === "about" && (
                      <div className="space-y-5 text-center flex flex-col items-center justify-center py-4">
                        <div className="w-12 h-12 rounded-xl bg-linear-to-tr from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center shadow-md">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-display font-bold text-lg text-foreground">OMNISCRIPT</h3>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            The unified system interface for secure script composing, deep neural contextual recall, and automated intelligence.
                          </p>
                        </div>

                        <div className="w-full max-w-sm rounded-xl border border-border/60 bg-muted/15 p-3 flex flex-col divide-y divide-border/40 text-xs text-left">
                          <div className="py-2 flex justify-between">
                            <span className="text-muted-foreground">Application Version</span>
                            <span className="font-semibold font-mono text-foreground">v1.2.0</span>
                          </div>
                          <div className="py-2 flex justify-between">
                            <span className="text-muted-foreground">Build Version</span>
                            <span className="font-semibold font-mono text-foreground">build-423-prod</span>
                          </div>
                          <div className="py-2 flex justify-between">
                            <span className="text-muted-foreground">Encryption Grade</span>
                            <span className="font-semibold text-foreground">Military SHA-256</span>
                          </div>
                        </div>

                        {/* Placeholders */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-[11px] text-muted-foreground font-medium">
                          <button 
                            onClick={() => {
                              toast({
                                title: "Privacy Policy",
                                description: "OMNISCRIPT enforces client-side data safety. Session histories are encrypted.",
                                variant: "success"
                              });
                            }}
                            className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                          >
                            Privacy Policy
                          </button>
                          <span>•</span>
                          <button 
                            onClick={() => {
                              toast({
                                title: "Terms of Service",
                                description: "Authorized user access parameters strictly govern platform utilization policies.",
                                variant: "success"
                              });
                            }}
                            className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                          >
                            Terms of Service
                          </button>
                          <span>•</span>
                          <button 
                            onClick={() => {
                              toast({
                                title: "Open Source Licenses",
                                description: "Licensed under the MIT Standard. Third-party components are stored securely.",
                                variant: "success"
                              });
                            }}
                            className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                          >
                            Licenses
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/20 border-t border-border flex justify-end shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
