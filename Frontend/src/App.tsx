/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import "./App.css";
import { api, getSettingsFromCookies } from "./services/api";
import { SOCKET_URL } from "./config";
import { io } from "socket.io-client";
import { useClerk, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { useSettings } from "./contexts/SettingsContext";

import { ChatSidebar } from "./components/ChatSidebar";
import { MainChat } from "./components/MainChat";
import type { SendMessagePayload } from "./components/MainChat";
import { Auth } from "./components/Auth";
import Profile from "./components/Profile";
import Saved from "./components/Saved";
import Settings from "./components/Settings";
import { CallOverlay } from "./components/CallOverlay";
import { ResizableDivider } from "./components/ResizableDivider";
import { useCall } from "./hooks/useCall";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire } from "@fortawesome/free-solid-svg-icons";
import {
  formatReactionsFromApi,
  loadPinnedIds,
  savePinnedIds,
} from "./utils/chatHeader";

interface CurrentUserData {
  id: string;
  name: string;
  isGuest?: boolean;
}

const formatLastSeen = (lastSeen?: string) => {
  if (!lastSeen) return "last seen recently";

  const seenAt = new Date(lastSeen);
  if (Number.isNaN(seenAt.getTime())) return "last seen recently";

  const now = new Date();
  const diffMs = now.getTime() - seenAt.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "last seen just now";
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `last seen ${minutes} min ago`;
  }

  if (seenAt.toDateString() === now.toDateString()) {
    return `last seen today at ${seenAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (seenAt.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${seenAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (diffMs < 7 * day) {
    return `last seen ${seenAt.toLocaleDateString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `last seen ${seenAt.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })}`;
};

const getInviteLink = (type: string, id: string) =>
  `${window.location.origin}/invite/${type}/${id}`;

const formatChatMessage = (msg: any, currentUserId: string) => ({
  id: msg._id,
  userId: msg.sender._id,
  text: msg.text,
  kind: msg.kind || "text",
  attachment: msg.attachment,
  poll: msg.poll,
  todo: msg.todo,
  reactions: formatReactionsFromApi(msg.reactions, currentUserId),
  timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
  isOwn: msg.sender._id === currentUserId,
  createdAt: msg.createdAt,
  editedAt: msg.editedAt ?? null,
  replyTo: msg.replyTo
    ? {
        id: typeof msg.replyTo === "object" ? msg.replyTo._id ?? msg.replyTo.id : msg.replyTo,
        text: msg.replyTo.text ?? "",
        senderName: msg.replyTo.sender
          ? `${msg.replyTo.sender.firstName ?? ""} ${msg.replyTo.sender.lastName ?? ""}`
              .trim()
          : "Message",
        kind: msg.replyTo.kind,
      }
    : null,
});

const CACHE_DEBOUNCE_MS = 400;

const getMessagePreview = (message: {
  text?: string;
  kind?: string;
  attachment?: { fileName?: string | null };
  poll?: { question?: string };
  todo?: { title?: string };
}) => {
  if (message.kind === "image") return "Photo";
  if (message.kind === "video") return "Video";
  if (message.kind === "file") return message.attachment?.fileName || "File";
  if (message.kind === "poll") return message.poll?.question || "Poll";
  if (message.kind === "todo") return message.todo?.title || "To-Do List";
  return message.text || "Message";
};

// Helper to synthesize a notification sound with three variants
const playNotificationSound = (variant: "default" | "subtle" | "loud" = "default") => {
  try {
    const audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const now = audioCtx.currentTime;

    if (variant === "subtle") {
      // Single very soft short tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (variant === "loud") {
      // Bold triple tone
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.15, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.1);
      });
    } else {
      // default — premium soft double-beep (D5 + A5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.08, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.22);
    }
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
};

// Helper: play a distinct mention alert tone
const playMentionSound = () => {
  try {
    const audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const now = audioCtx.currentTime;
    // Rising two-tone ping
    [440, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.15);
    });
  } catch (e) {
    console.error("Failed to play mention sound:", e);
  }
};

// Helper to show a Desktop Notification
const showNotification = (title: string, options?: any) => {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, options);
    } catch (e) {
      console.error("Failed to show browser notification:", e);
    }
  }
};

// Helper to vibrate (ignored gracefully if not supported)
const tryVibrate = (pattern: number | number[]) => {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // silently ignore
  }
};


interface LayoutProps {
  currentUserData: CurrentUserData;
  activeChat: any;
  messages: any[];
  users: Record<string, any>;
  onSendMessage: (payload: SendMessagePayload) => void;
  onBack?: () => void;
  messagesLoading?: boolean;
  children: React.ReactNode;
  onToggleTodo?: (messageId: string, itemIndex: number) => void;
  onClearChat?: (chatId: string) => void;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onEditMessage?: (messageId: string, newText: string) => Promise<void>;
  onReactToMessage?: (messageId: string, emoji: string) => Promise<void>;
  onStartCall?: (type: "audio" | "video") => void;
  isCallActive?: boolean;
  typingUsernames?: string[];
  onTyping?: () => void;
  onStopTyping?: () => void;
  targetMessageId?: string | null;
  onClearTargetMessageId?: () => void;
}

function GroupInviteRoute({
  currentUserData,
  onJoined,
}: {
  currentUserData: CurrentUserData | null;
  onJoined: (selectChatId?: string) => void;
}) {
  const { groupId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUserData || !groupId) return;

    let cancelled = false;
    api.chats
      .joinGroup(groupId)
      .then((group) => {
        if (cancelled) return;
        onJoined(group._id);
        navigate("/", { replace: true });
      })
      .catch((error) => {
        console.error("Failed to join group from invite link:", error);
        if (!cancelled) navigate("/", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserData, groupId, navigate, onJoined]);

  if (!currentUserData) {
    return <Navigate to="/auth" replace />;
  }

  return null;
}

interface MainLayoutProps extends LayoutProps {
  sidebarWidth: number;
  onSidebarResize: (width: number) => void;
}

function MainLayout({
  currentUserData,
  activeChat,
  messages,
  users,
  onSendMessage,
  onBack,
  messagesLoading,
  children,
  onToggleTodo,
  onClearChat,
  onDeleteMessage,
  onEditMessage,
  onReactToMessage,
  onStartCall,
  isCallActive,
  sidebarWidth,
  onSidebarResize,
  typingUsernames = [],
  onTyping,
  onStopTyping,
  targetMessageId,
  onClearTargetMessageId,
}: MainLayoutProps) {
  const location = useLocation();
  const isSubPage = ["/settings", "/saved", "/profile"].includes(location.pathname);
  const subPageClass = isSubPage ? "subpage-active" : "";

  const defaultActiveChat = activeChat || {
    id: "",
    name: "Select a chat",
    avatar: "F",
    avatarColor: "#4f46e5",
    status: "offline",
  };

  const isChatActive = activeChat && activeChat.id ? "chat-active" : "";

  return (
    <div className={`app-container ${isChatActive} ${subPageClass}`}>
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="chat-sidebar-wrapper"
      >
        {children}
      </div>
      <ResizableDivider
        onResize={onSidebarResize}
        minWidth={260}
        maxWidth={600}
      />
      <MainChat
        activeChat={defaultActiveChat}
        messages={messages}
        users={users}
        dateDividerText="Today"
        onlineText="ONLINE"
        messageInputPlaceholder="Write a message..."
        spotifyText="SPOTIFY"
        isGuest={currentUserData.isGuest}
        currentUserId={currentUserData.id}
        onSendMessage={onSendMessage}
        onBack={onBack}
        messagesLoading={messagesLoading}
        onToggleTodo={onToggleTodo}
        onClearChat={onClearChat}
        onDeleteMessage={onDeleteMessage}
        onEditMessage={onEditMessage}
        onReactToMessage={onReactToMessage}
        onStartCall={onStartCall}
        isCallActive={isCallActive}
        typingUsernames={typingUsernames}
        onTyping={onTyping}
        onStopTyping={onStopTyping}
        targetMessageId={targetMessageId}
        onClearTargetMessageId={onClearTargetMessageId}
      />
    </div>
  );
}

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    const isQuotaExceeded =
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        e.code === 22 ||
        e.code === 1014);

    if (isQuotaExceeded) {
      console.warn("Storage quota exceeded. Evicting older chat caches...");
      // Evict other chat caches
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("chat_cache_") && k !== key) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Try setting again
      try {
        localStorage.setItem(key, value);
        return;
      } catch (retryErr) {
        console.warn(
          "Failed to write cache after evicting others. Truncating current chat messages...",
          retryErr,
        );
      }

      // If still fails, try parsing and truncating the message list to last 15 messages
      try {
        const parsed = JSON.parse(value);
        if (
          parsed &&
          Array.isArray(parsed.formattedMsgs) &&
          parsed.formattedMsgs.length > 15
        ) {
          parsed.formattedMsgs = parsed.formattedMsgs.slice(-15);
          localStorage.setItem(key, JSON.stringify(parsed));
          return;
        }
      } catch (truncErr) {
        console.error("Failed to write truncated cache:", truncErr);
      }
    } else {
      console.error("Failed to write to localStorage:", e);
    }
  }
};

function App() {
  const { signOut } = useClerk();
  const { settings, updateLocalSettings } = useSettings();
  const [currentUserData, setCurrentUserData] =
    useState<CurrentUserData | null>(() => {
      const saved = localStorage.getItem("chat_user");
      return saved ? JSON.parse(saved) : null;
    });

  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [typingUsers, setTypingUsers] = useState<Record<string, Record<string, string>>>({});
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load and apply user settings on authentication / start
  useEffect(() => {
    if (!currentUserData) return;

    let cancelled = false;

    // Apply settings from cookies immediately for instant UI application
    const cookieSettings = getSettingsFromCookies();
    if (cookieSettings) {
      if (cookieSettings.theme) {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const shouldUseDark = cookieSettings.theme === "dark" || (cookieSettings.theme === "auto" && prefersDark);
        document.body.classList.toggle("light-theme", !shouldUseDark);
        localStorage.setItem("theme", shouldUseDark ? "dark" : "light");
      }
      if (cookieSettings.fontSize) {
        document.body.className = document.body.className.replace(/font-\w+/g, "");
        document.body.classList.add(`font-${cookieSettings.fontSize}`);
      }
      if (cookieSettings.compactMode !== undefined) {
        document.body.classList.toggle("compact-mode", cookieSettings.compactMode);
      }
    }

    const fetchAndApplySettings = async () => {
      try {
        const fetched = await api.settings.getSettings();
        if (cancelled) return;

        // Sync to context
        updateLocalSettings(fetched);

        // Apply theme
        if (fetched.theme) {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          const shouldUseDark = fetched.theme === "dark" || (fetched.theme === "auto" && prefersDark);
          document.body.classList.toggle("light-theme", !shouldUseDark);
          localStorage.setItem("theme", shouldUseDark ? "dark" : "light");
        }

        // Apply font size
        if (fetched.fontSize) {
          document.body.className = document.body.className.replace(/font-\w+/g, "");
          document.body.classList.add(`font-${fetched.fontSize}`);
        }

        // Apply compact mode
        if (fetched.compactMode !== undefined) {
          document.body.classList.toggle("compact-mode", fetched.compactMode);
        }
      } catch (error) {
        console.error("Failed to load and apply settings on startup:", error);
      }
    };

    void fetchAndApplySettings();

    return () => {
      cancelled = true;
    };
  }, [currentUserData]);

  // Request browser notification permission on login
  useEffect(() => {
    if (currentUserData && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [currentUserData]);

  // Update browser tab title with unread count
  useEffect(() => {
    const totalUnread = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) FireTalk`;
    } else {
      document.title = "FireTalk";
    }
  }, [chats]);

  const activeChatRef = useRef(activeChat);
  const isMobileRef = useRef(isMobile);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Keep a ref to settings so socket callbacks always read the latest value
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const socketRef = useRef<any>(null);
  const [socketInstance, setSocketInstance] = useState<any>(null);
  const cacheWriteTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const scheduleChatCacheWrite = useCallback(
    (chatId: string, formattedMsgs: any[], chatUsers: Record<string, any>) => {
      const timers = cacheWriteTimersRef.current;
      const existing = timers.get(chatId);
      if (existing) clearTimeout(existing);

      timers.set(
        chatId,
        setTimeout(() => {
          safeSetLocalStorage(
            `chat_cache_${chatId}`,
            JSON.stringify({ formattedMsgs, chatUsers }),
          );
          timers.delete(chatId);
        }, CACHE_DEBOUNCE_MS),
      );
    },
    [],
  );

  // Establish persistent Socket.IO connection when currentUserData is present
  useEffect(() => {
    if (!currentUserData) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { userId: currentUserData.id },
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server:", socket.id);
      // Join room for active chat if we are already in one
      if (activeChatRef.current?.id) {
        socket.emit("join_chat", activeChatRef.current.id);
      }
      // Emit online status preference on connect
      socket.emit("set_online_status_preference", {
        onlineStatus: settingsRef.current.onlineStatus !== false,
      });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    socket.on("user_typing", (payload: { chatId: string; userId: string; username: string }) => {
      if (settingsRef.current.typingIndicator === false) return;
      setTypingUsers((prev) => {
        const chatMap = prev[payload.chatId] || {};
        return {
          ...prev,
          [payload.chatId]: {
            ...chatMap,
            [payload.userId]: payload.username,
          },
        };
      });

      const timeoutKey = `${payload.chatId}-${payload.userId}`;
      const existing = typingTimeouts.get(timeoutKey);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const chatMap = prev[payload.chatId] || {};
          if (!chatMap[payload.userId]) return prev;
          const newMap = { ...chatMap };
          delete newMap[payload.userId];
          return {
            ...prev,
            [payload.chatId]: newMap,
          };
        });
        typingTimeouts.delete(timeoutKey);
      }, 5000);

      typingTimeouts.set(timeoutKey, timeout);
    });

    socket.on("user_stop_typing", (payload: { chatId: string; userId: string }) => {
      setTypingUsers((prev) => {
        const chatMap = prev[payload.chatId] || {};
        if (!chatMap[payload.userId]) return prev;
        const newMap = { ...chatMap };
        delete newMap[payload.userId];
        return {
          ...prev,
          [payload.chatId]: newMap,
        };
      });

      const timeoutKey = `${payload.chatId}-${payload.userId}`;
      const existing = typingTimeouts.get(timeoutKey);
      if (existing) {
        clearTimeout(existing);
        typingTimeouts.delete(timeoutKey);
      }
    });

    socket.on("user_status_changed", (payload: any) => {
      const activity =
        payload.status === "online"
          ? undefined
          : formatLastSeen(payload.lastSeen);

      setChats((prev) =>
        prev.map((chat) =>
          chat.type === "direct" && chat.userId === payload.userId
            ? {
                ...chat,
                status: payload.status,
                lastSeen: payload.lastSeen,
                activity,
              }
            : chat,
        ),
      );

      setActiveChat((prev: any) =>
        prev?.type === "direct" && prev.userId === payload.userId
          ? {
              ...prev,
              status: payload.status,
              lastSeen: payload.lastSeen,
              activity,
            }
          : prev,
      );

      setUsersMap((prev) => {
        const existing = prev[payload.userId];
        if (!existing) return prev;
        return {
          ...prev,
          [payload.userId]: {
            ...existing,
            status: payload.status,
            lastSeen: payload.lastSeen,
          },
        };
      });
    });

    // Listen for real-time messages
    socket.on("new_message", (msg: any) => {
      const messageChatId = String(msg.chatId ?? "");

      // 1. If this message is for the active chat, append it
      if (
        activeChatRef.current &&
        messageChatId === String(activeChatRef.current.id)
      ) {
        const formattedMsg = formatChatMessage(msg, currentUserData.id);

        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === msg._id)) {
            return prev;
          }
          // Remove temp messages and add the real one
          const filtered = prev.filter(
            (m) => !m.id.startsWith("temp-") && m.id !== msg._id,
          );
          const updated = [...filtered, formattedMsg];

          const cachedData = localStorage.getItem(
            `chat_cache_${messageChatId}`,
          );
          let chatUsers: Record<string, any> = {};
          if (cachedData) {
            try {
              chatUsers = JSON.parse(cachedData).chatUsers || {};
            } catch {
              chatUsers = {};
            }
          }
          chatUsers[msg.sender._id] = {
            id: msg.sender._id,
            name: `${msg.sender.firstName} ${msg.sender.lastName || ""}`.trim(),
            avatar: msg.sender.firstName[0],
            avatarUrl:
              typeof msg.sender.avatar === "string"
                ? msg.sender.avatar
                : msg.sender.avatar?.url || null,
            avatarColor:
              msg.sender._id === currentUserData.id ? "#10b981" : "#4f46e5",
            status: "online",
          };
          scheduleChatCacheWrite(messageChatId, updated, chatUsers);

          return updated;
        });

        // Ensure users map contains the sender
        setUsersMap((prev) => {
          if (prev[msg.sender._id]) return prev;
          return {
            ...prev,
            [msg.sender._id]: {
              id: msg.sender._id,
              name: `${msg.sender.firstName} ${msg.sender.lastName || ""}`.trim(),
              avatar: msg.sender.firstName[0],
              avatarUrl:
                typeof msg.sender.avatar === "string"
                  ? msg.sender.avatar
                  : msg.sender.avatar?.url || null,
              avatarColor:
                msg.sender._id === currentUserData.id ? "#10b981" : "#4f46e5",
              status: "online",
            },
          };
        });
      }

      // 2. Update last message and unread count in the sidebar
      const isOwnMessage = msg.sender._id === currentUserData.id;
      const isCurrentChat =
        activeChatRef.current &&
        messageChatId === String(activeChatRef.current.id);

      setChats((prev) =>
        prev.map((c) => {
          if (c.id === messageChatId) {
            const extraUnread = !isCurrentChat && !isOwnMessage ? 1 : 0;
            return {
              ...c,
              lastMessage: getMessagePreview(msg),
              timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              unreadCount: (c.unreadCount || 0) + extraUnread,
            };
          }
          return c;
        }),
      );

      // Play sound and show desktop notification for incoming messages from others
      if (!isOwnMessage) {
        const s = settingsRef.current;

        // Determine if this is a group/channel message
        const chatType = activeChatRef.current?.type;
        const isGroupOrChannel = chatType === "group" || chatType === "channel";

        // Check if the message is a @mention of the current user
        const currentUserName = currentUserData.name?.split(" ")[0]?.toLowerCase() ?? "";
        const isMention =
          currentUserName &&
          typeof msg.text === "string" &&
          msg.text.toLowerCase().includes(`@${currentUserName}`);

        // --- Sound ---
        if (s.soundEnabled !== false) {
          if (isMention && s.mentionSound !== false) {
            // Mention sound takes priority
            playMentionSound();
          } else if (!isGroupOrChannel || s.groupNotifications !== false) {
            // Regular notification sound respecting group setting
            playNotificationSound(s.notificationSound ?? "default");
          }
        }

        // --- Vibration ---
        if (s.notificationVibration !== false && (!isGroupOrChannel || s.groupNotifications !== false)) {
          tryVibrate([100, 50, 100]);
        }

        // --- Desktop notification ---
        if (s.notifications !== false) {
          // Skip group notifications if user turned them off
          const shouldNotify = !isGroupOrChannel || s.groupNotifications !== false;
          if (shouldNotify) {
            const isWindowHidden = document.hidden || !document.hasFocus();
            if (!isCurrentChat || isWindowHidden) {
              const senderName =
                `${msg.sender.firstName} ${msg.sender.lastName || ""}`.trim();
              const bodyText = getMessagePreview(msg);
              showNotification(senderName, {
                body: bodyText,
                tag: messageChatId,
                renotify: true,
              });
            }
          }
        }
      }
    });

    // Listen for poll updates
    socket.on("poll_updated", (payload: any) => {
      console.log("Poll updated via Socket.IO:", payload);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId ? { ...m, poll: payload.poll } : m,
        ),
      );
    });

    // Listen for todo updates
    socket.on("message_deleted", (payload: any) => {
      const chatId = String(payload.chatId ?? "");
      if (
        activeChatRef.current &&
        chatId === String(activeChatRef.current.id)
      ) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      }
    });

    socket.on("reaction_updated", (payload: any) => {
      if (!currentUserData) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
                ...m,
                reactions: formatReactionsFromApi(
                  payload.reactions,
                  currentUserData.id,
                ),
              }
            : m,
        ),
      );
    });

    // Listen for message edits
    socket.on("message_edited", (payload: any) => {
      const editedChatId = String(payload.chatId ?? "");
      if (
        activeChatRef.current &&
        editedChatId === String(activeChatRef.current.id)
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? { ...m, text: payload.text, editedAt: payload.editedAt }
              : m,
          ),
        );
      }
    });

    socket.on("todo_updated", (payload: any) => {
      console.log("Todo updated via Socket.IO:", payload);
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === payload.messageId ? { ...m, todo: payload.todo } : m,
        );
        if (activeChatRef.current?.id) {
          const chatId = activeChatRef.current.id;
          const cachedData = localStorage.getItem(`chat_cache_${chatId}`);
          let chatUsers: Record<string, any> = {};
          if (cachedData) {
            try {
              chatUsers = JSON.parse(cachedData).chatUsers || {};
            } catch {
              chatUsers = {};
            }
          }
          scheduleChatCacheWrite(chatId, updated, chatUsers);
        }
        return updated;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [currentUserData, scheduleChatCacheWrite]);

  // Synchronise online status preference with server on startup or preference change
  useEffect(() => {
    if (socketInstance && settings.onlineStatus !== undefined) {
      socketInstance.emit("set_online_status_preference", {
        onlineStatus: settings.onlineStatus !== false,
      });
    }
  }, [socketInstance, settings.onlineStatus]);

  const {
    callState,
    peer: callPeer,
    callType,
    isInCall,
    isMuted,
    isVideoEnabled,
    callDuration,
    callError,
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    clearError,
  } = useCall(socketInstance, currentUserData?.id ?? "");

  const handleStartCall = useCallback(
    (type: "audio" | "video") => {
      if (!activeChat || activeChat.type !== "direct" || !activeChat.userId)
        return;
      void startCall(activeChat.userId, activeChat.name, activeChat.id, type);
    },
    [activeChat, startCall],
  );

  // Join/leave room on activeChat change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeChat) return;

    const chatId = activeChat.id;
    socket.emit("join_chat", chatId);

    return () => {
      socket.emit("leave_chat", chatId);
    };
  }, [activeChat]);

  const loadChats = useCallback(
    async (selectChatId?: string, silent = false) => {
      if (!currentUserData) return;
      try {
        if (!silent) {
          setChatsLoading(true);
        }
        // Single request instead of 3 separate ones
        const { conversations, groups, channels } =
          await api.chats.getAllChats();

        const formattedChats: any[] = [
          ...conversations.map((c) => {
            const other = c.participants.find(
              (p) => p._id !== currentUserData.id,
            );
            return {
              id: c._id,
              userId: other?._id || "",
              name: other
                ? `${other.firstName} ${other.lastName || ""}`.trim()
                : "Saved Messages",
              avatar: other?.firstName[0] || "U",
              avatarUrl:
                typeof other?.avatar === "string"
                  ? other.avatar
                  : other?.avatar?.url || null,
              avatarColor: "#4f46e5",
              lastMessage:
                typeof c.lastMessage === "string"
                  ? c.lastMessage
                  : c.lastMessage?.text || "No messages yet",
              timestamp: c.lastMessageAt
                ? new Date(c.lastMessageAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              type: "direct",
              status: other?.status || "offline",
              lastSeen: other?.lastSeen,
              activity:
                other?.status === "online"
                  ? undefined
                  : formatLastSeen(other?.lastSeen),
            };
          }),
          ...groups.map((g) => ({
            id: g._id,
            name: g.name,
            avatar: g.name[0],
            avatarUrl: g.avatar?.url || null,
            avatarColor: "#65758f",
            lastMessage: "Group Chat",
            timestamp: new Date(g.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            type: "group",
            status: "offline",
            activity: `${g.members?.length || 0} members`,
            inviteLink: getInviteLink("group", g._id),
          })),
          ...channels.map((ch) => ({
            id: ch._id,
            name: ch.name,
            avatar: ch.name[0],
            avatarUrl: ch.avatar?.url || null,
            avatarColor: "#58677d",
            lastMessage: "Channel",
            timestamp: new Date(ch.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            type: "channel",
            status: "offline",
            activity:
              ch.type === "private" ? "Private channel" : "Public channel",
          })),
        ];

        setChats((prevChats) => {
          return formattedChats.map((newChat) => {
            const prevChat = prevChats.find((pc) => pc.id === newChat.id);
            const unreadCount = prevChat ? prevChat.unreadCount || 0 : 0;
            return {
              ...newChat,
              unreadCount:
                activeChatRef.current?.id === newChat.id ? 0 : unreadCount,
            };
          });
        });

        if (selectChatId) {
          const found = formattedChats.find((c) => c.id === selectChatId);
          if (found) setActiveChat(found);
        } else if (
          !activeChatRef.current &&
          formattedChats.length > 0 &&
          !isMobileRef.current
        ) {
          setActiveChat(formattedChats[0]);
        }
      } catch (err) {
        console.error("Failed to load chats:", err);
      } finally {
        setChatsLoading(false);
      }
    },
    [currentUserData],
  );

  useEffect(() => {
    if (currentUserData) {
      loadChats();
    } else {
      setChats([]);
      setActiveChat(null);
      setMessages([]);
    }
  }, [currentUserData, loadChats]);

  const handleSelectChat = useCallback((chat: any) => {
    setActiveChat(chat);
    setChats((prevChats) =>
      prevChats.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  const handleGoToMessage = useCallback(
    (_chatType: string, chatId: string, messageId: string) => {
      // Try to find the chat in the already-loaded list
      setChats((prev) => {
        const found = prev.find((c) => c.id === chatId);
        if (found) {
          setActiveChat(found);
        } else {
          // Chat not loaded yet — trigger a reload and select it when done
          void loadChats(chatId, true);
        }
        return prev;
      });
      setTargetMessageId(messageId);
    },
    [loadChats],
  );

  // Track current chat to prevent race conditions on fast switching
  const loadingChatIdRef = useRef<string | null>(null);
  const messagesLoadedForChatRef = useRef<string | null>(null);

  const activeChatId = activeChat?.id ?? null;
  const currentUserId = currentUserData?.id ?? null;

  useEffect(() => {
    if (!activeChatId || !currentUserData) {
      messagesLoadedForChatRef.current = null;
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    // Same chat already loaded — reactions, pins, edits update state in place
    if (messagesLoadedForChatRef.current === activeChatId) {
      return;
    }

    const chatId = activeChatId;
    messagesLoadedForChatRef.current = chatId;
    loadingChatIdRef.current = chatId;

    // Load from cache immediately
    const cachedData = localStorage.getItem(`chat_cache_${chatId}`);
    let hasCache = false;
    if (cachedData) {
      try {
        const { formattedMsgs, chatUsers } = JSON.parse(cachedData);
        if (Array.isArray(formattedMsgs)) {
          setMessages(formattedMsgs);
          if (chatUsers) {
            setUsersMap((prev) => ({ ...prev, ...chatUsers }));
          }
          setMessagesLoading(false);
          hasCache = true;
        }
      } catch (e) {
        console.error("Failed to parse cached chat messages:", e);
      }
    }

    if (!hasCache) {
      // Clear immediately so old messages never flash
      setMessages([]);
      setMessagesLoading(true);
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const chatMeta = activeChatRef.current;
        let chatType: "group" | "channel" | "direct" = "direct";
        if (chatMeta?.type === "group") chatType = "group";
        if (chatMeta?.type === "channel") chatType = "channel";

        const msgs = await api.chats.getMessages({
          chatType,
          chatId,
          limit: 50,
        });

        // Stale check: if user already switched to a different chat, discard
        if (cancelled || loadingChatIdRef.current !== chatId) return;

        const formattedMsgs = msgs
          .map((m: any) => formatChatMessage(m, currentUserData.id))
          .reverse();

        const newUsersMap: Record<string, any> = {};
        newUsersMap[currentUserData.id] = {
          id: currentUserData.id,
          name: currentUserData.name,
          avatar: currentUserData.name[0],
          avatarColor: "#10b981",
          status: "online",
          type: "direct",
        };
        msgs.forEach((m: any) => {
          newUsersMap[m.sender._id] = {
            id: m.sender._id,
            name: `${m.sender.firstName} ${m.sender.lastName || ""}`.trim(),
            avatar: m.sender.firstName[0],
            avatarUrl:
              typeof m.sender.avatar === "string"
                ? m.sender.avatar
                : m.sender.avatar?.url || null,
            avatarColor:
              m.sender._id === currentUserData.id ? "#10b981" : "#4f46e5",
            status: "online",
          };
        });

        setUsersMap((prev) => ({ ...prev, ...newUsersMap }));
        setMessages(formattedMsgs);

        scheduleChatCacheWrite(chatId, formattedMsgs, newUsersMap);
      } catch (err) {
        if (!cancelled) console.error("Failed to load messages:", err);
      } finally {
        if (!cancelled && loadingChatIdRef.current === chatId) {
          setMessagesLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeChatId, currentUserId, currentUserData, scheduleChatCacheWrite]);

  const typingUsernames = Object.values(typingUsers[activeChat?.id] || {});

  const handleTyping = useCallback(() => {
    if (socketInstance && activeChat?.id) {
      socketInstance.emit("typing", {
        chatId: activeChat.id,
        username: currentUserData?.name || "Someone",
      });
    }
  }, [socketInstance, activeChat?.id, currentUserData]);

  const handleStopTyping = useCallback(() => {
    if (socketInstance && activeChat?.id) {
      socketInstance.emit("stop_typing", {
        chatId: activeChat.id,
      });
    }
  }, [socketInstance, activeChat?.id]);

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim()) return;
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, text: newText.trim(), editedAt: new Date().toISOString() }
            : m,
        ),
      );
      try {
        await api.chats.editMessage(messageId, newText.trim());
      } catch (err) {
        console.error("Failed to edit message:", err);
      }
    },
    [],
  );

  const handleSendMessage = (payload: SendMessagePayload) => {
    if (!activeChat || !currentUserData) return;

    const text = payload.text?.trim() || "";
    const kind = payload.kind || "text";
    if (kind === "text" && !text) return;

    // Optimistic update: show message immediately
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const optimisticMsg = {
      id: tempId,
      userId: currentUserData.id,
      text,
      kind,
      attachment: payload.attachment,
      poll: payload.poll,
      todo: payload.todo,
      timestamp: now,
      isOwn: true,
      createdAt: new Date().toISOString(),
    };
    const preview = getMessagePreview(optimisticMsg);
    setMessages((prev) => [...prev, optimisticMsg]);
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, lastMessage: preview, timestamp: now }
          : c,
      ),
    );

    void (async () => {
      try {
        let chatType: "group" | "channel" | "direct" = "direct";
        if (activeChat.type === "group") chatType = "group";
        if (activeChat.type === "channel") chatType = "channel";

        const sentMsg = await api.chats.sendMessage({
          chatType,
          chatId: activeChat.id,
          text,
          kind,
          replyTo: (payload as any).replyTo,
          attachment: payload.attachment,
          poll: payload.poll,
          todo: payload.todo,
        });

        const confirmed = formatChatMessage(sentMsg, currentUserData.id);

        // Socket may have already replaced the temp message
        setMessages((prev) => {
          if (prev.some((m) => m.id === confirmed.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          const updated = prev.map((m) => (m.id === tempId ? confirmed : m));

          const cachedData = localStorage.getItem(
            `chat_cache_${activeChat.id}`,
          );
          let chatUsers: Record<string, any> = {};
          if (cachedData) {
            try {
              chatUsers = JSON.parse(cachedData).chatUsers || {};
            } catch {
              chatUsers = {};
            }
          }
          scheduleChatCacheWrite(activeChat.id, updated, chatUsers);
          return updated;
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    })();
  };

  const handleClearChat = useCallback((chatId: string) => {
    setMessages([]);
    localStorage.removeItem(`chat_cache_${chatId}`);
    localStorage.removeItem(`chat_pins_${chatId}`);
    if (messagesLoadedForChatRef.current === chatId) {
      messagesLoadedForChatRef.current = null;
    }
  }, []);

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      await api.chats.deleteMessage(messageId);
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== messageId);
        const chatId = activeChatRef.current?.id;
        if (chatId) {
          const cachedData = localStorage.getItem(`chat_cache_${chatId}`);
          if (cachedData) {
            try {
              const { chatUsers } = JSON.parse(cachedData);
              scheduleChatCacheWrite(chatId, updated, chatUsers);
            } catch {
              /* ignore */
            }
          }
        }
        return updated;
      });
      const chatId = activeChatRef.current?.id;
      if (chatId) {
        const pins = loadPinnedIds(chatId).filter((id) => id !== messageId);
        savePinnedIds(chatId, pins);
      }
    },
    [scheduleChatCacheWrite],
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUserData) return;
      try {
        const { reactions } = await api.chats.reactToMessage(messageId, emoji);
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: formatReactionsFromApi(
                    reactions,
                    currentUserData.id,
                  ),
                }
              : m,
          );
          const chatId = activeChatRef.current?.id;
          if (chatId) {
            const cachedData = localStorage.getItem(`chat_cache_${chatId}`);
            let chatUsers: Record<string, any> = {};
            if (cachedData) {
              try {
                chatUsers = JSON.parse(cachedData).chatUsers || {};
              } catch {
                /* ignore */
              }
            }
            scheduleChatCacheWrite(chatId, updated, chatUsers);
          }
          return updated;
        });
      } catch (error) {
        console.error("Failed to react:", error);
      }
    },
    [currentUserData, scheduleChatCacheWrite],
  );

  const handleToggleTodo = async (messageId: string, itemIndex: number) => {
    if (!currentUserData) return;

    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== messageId || !m.todo) return m;

        const todoItems = Array.isArray(m.todo.items)
          ? m.todo.items.map((item: any) =>
              typeof item === "string"
                ? { text: item, completedBy: [] }
                : { ...item },
            )
          : [];

        const item = todoItems[itemIndex];
        if (item) {
          const completedBy = item.completedBy || [];
          const already = completedBy.some(
            (c: any) => c.userId === currentUserData.id,
          );
          if (already) {
            item.completedBy = completedBy.filter(
              (c: any) => c.userId !== currentUserData.id,
            );
          } else {
            item.completedBy = [
              ...completedBy,
              {
                userId: currentUserData.id,
                completedAt: new Date().toISOString(),
              },
            ];
          }
        }

        const newMsg = {
          ...m,
          todo: {
            ...m.todo,
            items: todoItems,
          },
        };

        if (activeChatRef.current?.id) {
          const chatId = activeChatRef.current.id;
          const cachedData = localStorage.getItem(`chat_cache_${chatId}`);
          if (cachedData) {
            try {
              const { chatUsers } = JSON.parse(cachedData);
              const cacheMsgs =
                JSON.parse(localStorage.getItem(`chat_cache_${chatId}`) || "{}")
                  .formattedMsgs || [];
              const updatedCacheMsgs = cacheMsgs.map((cm: any) =>
                cm.id === messageId ? newMsg : cm,
              );
              safeSetLocalStorage(
                `chat_cache_${chatId}`,
                JSON.stringify({
                  formattedMsgs: updatedCacheMsgs,
                  chatUsers,
                }),
              );
            } catch (e) {
              console.error(e);
            }
          }
        }

        return newMsg;
      });
      return updated;
    });

    try {
      await api.chats.toggleTodoItem(messageId, itemIndex);
    } catch (error) {
      console.error("Failed to toggle todo item:", error);
    }
  };

  const handleLoginSuccess = (user: CurrentUserData) => {
    localStorage.setItem("chat_user", JSON.stringify(user));
    setCurrentUserData(user);
  };

  const handleLogout = async () => {
    localStorage.removeItem("chat_user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setCurrentUserData(null);
    try {
      await signOut();
    } catch (e) {
      console.error("Clerk sign out error:", e);
    }
  };

  // Filter chats by tab
  const filteredChats = chats.filter((c) => {
    if (activeTab === "all") return true;
    return c.type === activeTab;
  });

  const tabsData = [
    { id: "all", label: "All", isActive: activeTab === "all" },
    { id: "direct", label: "Direct", isActive: activeTab === "direct" },
    { id: "group", label: "Groups", isActive: activeTab === "group" },
    { id: "channel", label: "Channels", isActive: activeTab === "channel" },
  ];

  return (
    <>
      {currentUserData && (
        <CallOverlay
          callState={callState}
          peer={callPeer}
          callType={callType}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          callError={callError}
          remoteAudioRef={remoteAudioRef}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          onAccept={() => void acceptCall()}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onClearError={clearError}
        />
      )}
      {currentUserData && chatsLoading && (
        <div className="fire-loader-overlay">
          <div className="auth-logo-container fire-loading-pulse">
            <div className="auth-logo-circle">
              <FontAwesomeIcon
                icon={faFire}
                style={{ fontSize: "56px", color: "#ffffff" }}
              />
            </div>
          </div>
          <div className="fire-loader-text">Igniting FireTalk...</div>
        </div>
      )}
      <BrowserRouter>
        <Routes>
          <Route
            path="/auth"
            element={
              currentUserData ? (
                <Navigate to="/" replace />
              ) : (
                <Auth onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          <Route
            path="/sso-callback"
            element={<AuthenticateWithRedirectCallback />}
          />

          <Route
            path="/"
            element={
              currentUserData ? (
                <MainLayout
                  currentUserData={currentUserData}
                  activeChat={activeChat}
                  messages={messages}
                  users={usersMap}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveChat(null)}
                  messagesLoading={messagesLoading}
                  onToggleTodo={handleToggleTodo}
                  onClearChat={handleClearChat}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onReactToMessage={handleReactToMessage}
                  onStartCall={handleStartCall}
                  isCallActive={isInCall}
                  sidebarWidth={sidebarWidth}
                  onSidebarResize={setSidebarWidth}
                  typingUsernames={typingUsernames}
                  onTyping={handleTyping}
                  onStopTyping={handleStopTyping}
                  targetMessageId={targetMessageId}
                  onClearTargetMessageId={() => setTargetMessageId(null)}
                >
                  <ChatSidebar
                    searchPlaceholder="Search..."
                    listTitle={
                      activeTab === "all"
                        ? "All Chats"
                        : activeTab === "direct"
                          ? "Direct Messages"
                          : activeTab === "group"
                            ? "Groups"
                            : "Channels"
                    }
                    tabs={tabsData}
                    chats={filteredChats.map((c) => ({
                      ...c,
                      isActive: activeChat?.id === c.id,
                    }))}
                    onLogout={handleLogout}
                    onSelectChat={handleSelectChat}
                    onTabChange={(tabId) => setActiveTab(tabId)}
                    onChatCreated={(chatId) => loadChats(chatId, true)}
                  />
                </MainLayout>
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />

          <Route
            path="/profile"
            element={
              currentUserData ? (
                <MainLayout
                  currentUserData={currentUserData}
                  activeChat={activeChat}
                  messages={messages}
                  users={usersMap}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveChat(null)}
                  onToggleTodo={handleToggleTodo}
                  onClearChat={handleClearChat}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onReactToMessage={handleReactToMessage}
                  onStartCall={handleStartCall}
                  isCallActive={isInCall}
                  sidebarWidth={sidebarWidth}
                  onSidebarResize={setSidebarWidth}
                  typingUsernames={typingUsernames}
                  onTyping={handleTyping}
                  onStopTyping={handleStopTyping}
                >
                  <div className="profile-container">
                    <Profile />
                  </div>
                </MainLayout>
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />

          <Route
            path="/saved"
            element={
              currentUserData ? (
                <MainLayout
                  currentUserData={currentUserData}
                  activeChat={activeChat}
                  messages={messages}
                  users={usersMap}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveChat(null)}
                  messagesLoading={messagesLoading}
                  onToggleTodo={handleToggleTodo}
                  onClearChat={handleClearChat}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onReactToMessage={handleReactToMessage}
                  onStartCall={handleStartCall}
                  isCallActive={isInCall}
                  sidebarWidth={sidebarWidth}
                  onSidebarResize={setSidebarWidth}
                  typingUsernames={typingUsernames}
                  onTyping={handleTyping}
                  onStopTyping={handleStopTyping}
                  targetMessageId={targetMessageId}
                  onClearTargetMessageId={() => setTargetMessageId(null)}
                >
                  <Saved onGoToMessage={handleGoToMessage} />
                </MainLayout>
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />

          <Route
            path="/settings"
            element={
              currentUserData ? (
                <MainLayout
                  currentUserData={currentUserData}
                  activeChat={activeChat}
                  messages={messages}
                  users={usersMap}
                  onSendMessage={handleSendMessage}
                  onBack={() => setActiveChat(null)}
                  onToggleTodo={handleToggleTodo}
                  onClearChat={handleClearChat}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onReactToMessage={handleReactToMessage}
                  onStartCall={handleStartCall}
                  isCallActive={isInCall}
                  sidebarWidth={sidebarWidth}
                  onSidebarResize={setSidebarWidth}
                  typingUsernames={typingUsernames}
                  onTyping={handleTyping}
                  onStopTyping={handleStopTyping}
                >
                  <Settings />
                </MainLayout>
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />

          <Route
            path="/invite/group/:groupId"
            element={
              <GroupInviteRoute
                currentUserData={currentUserData}
                onJoined={(chatId) => loadChats(chatId, true)}
              />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
