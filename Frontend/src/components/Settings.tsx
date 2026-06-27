import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBell,
  faLock,
  faDatabase,
  faPalette,
} from "@fortawesome/free-solid-svg-icons";
import "./Settings.css";
import { api, type UserSettings, getSettingsFromCookies } from "../services/api";
import { useSettings } from "../contexts/SettingsContext";
import { useModal } from "./Modal";

const defaultSettings: UserSettings = {
  _id: "",
  userId: "",
  // Appearance & Chat Settings
  theme: "dark",
  appearanceTheme: "system",
  language: "en",
  fontSize: "medium",
  compactMode: false,
  messagePreview: true,

  // Notifications & Sounds
  notifications: true,
  soundEnabled: true,
  notificationSound: "default",
  notificationVibration: true,
  groupNotifications: true,
  mentionSound: true,

  // Privacy & Security
  onlineStatus: true,
  privateMessages: "all",
  readReceipts: true,
  typingIndicator: true,
  lastSeen: true,
  twoFactorAuth: false,
  blockUnknown: false,

  // Data & Storage
  messageRetention: "forever",
  autoClearCache: false,
  downloadMedia: true,

  updatedAt: "",
};

const Settings = () => {
  const navigate = useNavigate();
  const { updateLocalSettings } = useSettings();
  const { showAlert } = useModal();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      // Optimistically load from cookies first
      const cookieSettings = getSettingsFromCookies();
      if (cookieSettings && !cancelled) {
        setSettings({ ...defaultSettings, ...cookieSettings } as UserSettings);
      }

      try {
        const data = await api.settings.getSettings();
        if (!cancelled) setSettings({ ...defaultSettings, ...data });
      } catch (err: any) {
        if (!cookieSettings && !cancelled) {
          setError(err.message || "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    const previous = settings;
    const next = { ...settings, ...updates };
    setSettings(next);
    setSaving(true);
    setError(null);

    if (updates.fontSize) {
      document.body.className = document.body.className.replace(
        /font-\w+/g,
        "",
      );
      document.body.classList.add(`font-${updates.fontSize}`);
    }

    if (updates.compactMode !== undefined) {
      document.body.classList.toggle("compact-mode", updates.compactMode);
    }

    try {
      const response = await api.settings.updateSettings(updates);
      const merged = { ...defaultSettings, ...response.settings };
      setSettings(merged);
      updateLocalSettings(merged);
    } catch (err: any) {
      setSettings(previous);
      updateLocalSettings(previous);
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof UserSettings) => {
    void updateSettings({ [key]: !settings[key] } as Partial<UserSettings>);
  };

  const handleClearCache = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("chat_cache_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      showAlert("Local chat cache cleared successfully!");
    } catch (err) {
      console.error("Failed to clear local cache:", err);
      showAlert("Failed to clear local cache");
    }
  };

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button
          className="settings-back-btn"
          onClick={() => navigate("/")}
          aria-label="Back"
          type="button"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span className="settings-header-title">Settings</span>
        {saving && <span className="settings-saving">Saving...</span>}
      </div>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-content">
        {loading ? (
          <div className="settings-loading">Loading settings...</div>
        ) : (
          <>
            {/* APPEARANCE & CHAT SETTINGS */}
            <section className="settings-section">
              <div className="settings-section-title">
                <FontAwesomeIcon icon={faPalette} />
                Appearance & Chat Settings
              </div>

              <div className="settings-row">
                <span>Language</span>
                <select
                  value={settings.language || "en"}
                  onChange={(e) =>
                    void updateSettings({
                      language: e.target.value,
                    })
                  }
                >
                  <option value="en">English (EN)</option>
                  <option value="es">Español (ES)</option>
                  <option value="ru">Русский (RU)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="de">Deutsch (DE)</option>
                  <option value="zh">中文 (ZH)</option>
                </select>
              </div>

              <div className="settings-row">
                <span>Font Size</span>
                <select
                  value={settings.fontSize || "medium"}
                  onChange={(e) =>
                    void updateSettings({
                      fontSize: e.target.value as UserSettings["fontSize"],
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("compactMode")}
              >
                <span>Compact Mode</span>
                <span
                  className={`settings-switch ${settings.compactMode ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("messagePreview")}
              >
                <span>Message Preview</span>
                <span
                  className={`settings-switch ${settings.messagePreview ? "on" : ""}`}
                />
              </button>
            </section>

            {/* NOTIFICATIONS & SOUNDS */}
            <section className="settings-section">
              <div className="settings-section-title">
                <FontAwesomeIcon icon={faBell} />
                Notifications & Sounds
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("notifications")}
              >
                <span>Message Notifications</span>
                <span
                  className={`settings-switch ${settings.notifications ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("groupNotifications")}
              >
                <span>Group Notifications</span>
                <span
                  className={`settings-switch ${settings.groupNotifications ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("soundEnabled")}
              >
                <span>Sound Effects</span>
                <span
                  className={`settings-switch ${settings.soundEnabled ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("mentionSound")}
              >
                <span>Mention Sound Alert</span>
                <span
                  className={`settings-switch ${settings.mentionSound ? "on" : ""}`}
                />
              </button>

              <div className="settings-row">
                <span>Notification Sound</span>
                <select
                  value={settings.notificationSound || "default"}
                  onChange={(e) =>
                    void updateSettings({
                      notificationSound: e.target
                        .value as UserSettings["notificationSound"],
                    })
                  }
                >
                  <option value="default">Default</option>
                  <option value="subtle">Subtle</option>
                  <option value="loud">Loud</option>
                </select>
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("notificationVibration")}
              >
                <span>Vibration</span>
                <span
                  className={`settings-switch ${settings.notificationVibration ? "on" : ""}`}
                />
              </button>
            </section>

            {/* PRIVACY & SECURITY */}
            <section className="settings-section">
              <div className="settings-section-title">
                <FontAwesomeIcon icon={faLock} />
                Privacy & Security
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("onlineStatus")}
              >
                <span>Show Online Status</span>
                <span
                  className={`settings-switch ${settings.onlineStatus ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("lastSeen")}
              >
                <span>Show Last Seen</span>
                <span
                  className={`settings-switch ${settings.lastSeen ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("readReceipts")}
              >
                <span>Read Receipts</span>
                <span
                  className={`settings-switch ${settings.readReceipts ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("typingIndicator")}
              >
                <span>Typing Indicator</span>
                <span
                  className={`settings-switch ${settings.typingIndicator ? "on" : ""}`}
                />
              </button>

              <div className="settings-row">
                <span>Who Can Message Me</span>
                <select
                  value={settings.privateMessages || "all"}
                  onChange={(e) =>
                    void updateSettings({
                      privateMessages: e.target
                        .value as UserSettings["privateMessages"],
                    })
                  }
                >
                  <option value="all">Everybody</option>
                  <option value="friends">Contacts Only</option>
                  <option value="none">Nobody</option>
                </select>
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("blockUnknown")}
              >
                <span>Block Unknown Users</span>
                <span
                  className={`settings-switch ${settings.blockUnknown ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("twoFactorAuth")}
              >
                <span>Two-Factor Authentication</span>
                <span
                  className={`settings-switch ${settings.twoFactorAuth ? "on" : ""}`}
                />
              </button>
            </section>

            {/* DATA & STORAGE */}
            <section className="settings-section">
              <div className="settings-section-title">
                <FontAwesomeIcon icon={faDatabase} />
                Data & Storage
              </div>

              <div className="settings-row">
                <span>Message Retention</span>
                <select
                  value={settings.messageRetention || "forever"}
                  onChange={(e) =>
                    void updateSettings({
                      messageRetention: e.target
                        .value as UserSettings["messageRetention"],
                    })
                  }
                >
                  <option value="forever">Keep Forever</option>
                  <option value="1year">1 Year</option>
                  <option value="6months">6 Months</option>
                  <option value="3months">3 Months</option>
                </select>
              </div>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("downloadMedia")}
              >
                <span>Download Media</span>
                <span
                  className={`settings-switch ${settings.downloadMedia ? "on" : ""}`}
                />
              </button>

              <button
                className="settings-toggle-row"
                onClick={() => toggle("autoClearCache")}
              >
                <span>Auto-Clear Cache</span>
                <span
                  className={`settings-switch ${settings.autoClearCache ? "on" : ""}`}
                />
              </button>

              <div className="settings-row">
                <span>Clear Cache Now</span>
                <button
                  type="button"
                  className="settings-action-btn"
                  onClick={handleClearCache}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-darker)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  Clear Cache
                </button>
              </div>

              <div className="settings-info">
                <span>
                  Clearing cache will remove temporary files and may improve
                  performance.
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
