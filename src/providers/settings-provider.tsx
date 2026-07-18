import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface UserSettings {
  reduceMotion: boolean;
  enterToSend: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  smoothStreaming: boolean;
  rememberLastConversation: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  focusIndicators: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  reduceMotion: false,
  enterToSend: true,
  autoScroll: true,
  showTimestamps: true,
  smoothStreaming: true,
  rememberLastConversation: true,
  keyboardNavigation: true,
  highContrast: false,
  focusIndicators: true,
};

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("omniscript-user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      } catch (e) {
        console.error("Failed to load user settings", e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("omniscript-user-settings", JSON.stringify(updated));
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem("omniscript-user-settings", JSON.stringify(DEFAULT_SETTINGS));
  };

  // Sync classes to HTML element for Accessibility preferences (High Contrast, Focus Indicators, Reduced Motion)
  useEffect(() => {
    const root = window.document.documentElement;
    
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    if (settings.focusIndicators) {
      root.classList.add("show-focus-indicators");
    } else {
      root.classList.remove("show-focus-indicators");
    }

    if (settings.reduceMotion) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }
  }, [settings.highContrast, settings.focusIndicators, settings.reduceMotion]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within a SettingsProvider");
  }
  return context;
}
