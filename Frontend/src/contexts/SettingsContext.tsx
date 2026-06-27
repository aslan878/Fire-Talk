import React, { createContext, useContext, useState, useCallback } from "react";
import type { UserSettings } from "../services/api";
import { getSettingsFromCookies } from "../services/api";

const defaultSettings: UserSettings = {
  _id: "",
  userId: "",
  theme: "dark",
  appearanceTheme: "system",
  language: "en",
  fontSize: "medium",
  compactMode: false,
  messagePreview: true,
  notifications: true,
  soundEnabled: true,
  notificationSound: "default",
  notificationVibration: true,
  groupNotifications: true,
  mentionSound: true,
  onlineStatus: true,
  privateMessages: "all",
  readReceipts: true,
  typingIndicator: true,
  lastSeen: true,
  twoFactorAuth: false,
  blockUnknown: false,
  messageRetention: "forever",
  autoClearCache: false,
  downloadMedia: true,
  updatedAt: "",
};

interface SettingsContextValue {
  settings: UserSettings;
  updateLocalSettings: (updates: Partial<UserSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  updateLocalSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    // Initialise from cookies immediately so settings are available on first render
    const cookies = getSettingsFromCookies();
    return { ...defaultSettings, ...(cookies ?? {}) } as UserSettings;
  });

  const updateLocalSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateLocalSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
