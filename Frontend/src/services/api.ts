/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_URL } from "../config";

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  username?: string;
  bio?: string;
  birthday?: string;
  avatar?: string | null;
  isGuest?: boolean;
  status?: "online" | "offline";
  lastSeen?: string;
}

export interface AuthResponse {
  success?: boolean;
  isNewUser?: boolean;
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface AvatarInfo {
  url: string | null;
  publicId: string | null;
}

export interface ChatMember {
  user: string; // User ID
  role: "member" | "admin" | "owner";
  joinedAt: string;
}

export interface Channel {
  _id: string;
  name: string;
  description: string;
  type: "public" | "private";
  owner: string;
  members: ChatMember[];
  admins: string[];
  avatar?: AvatarInfo;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  _id: string;
  name: string;
  description: string;
  type: "public" | "private";
  owner: string;
  members: ChatMember[];
  admins: string[];
  avatar?: AvatarInfo;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  _id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  avatar?: string | AvatarInfo | null;
  status?: "online" | "offline" | "idle" | "dnd";
  lastSeen?: string;
}

export interface Conversation {
  _id: string;
  participants: ConversationParticipant[];
  lastMessage?:
    | string
    | {
        _id: string;
        text: string;
        kind: string;
        createdAt: string;
        sender: string;
      };
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageSender {
  _id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  avatar?: string | AvatarInfo | null;
  status?: "online" | "offline";
  lastSeen?: string;
}

export interface MessageAttachment {
  url?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
  durationSec?: number | null;
  publicId?: string | null;
}

export interface MessagePoll {
  question: string;
  options: string[];
  votes?: Array<{
    userId: string;
    optionIndex: number;
    votedAt?: string;
  }>;
}

export interface MessageTodo {
  title: string;
  items: Array<
    | string
    | {
        text: string;
        completedBy?: Array<{ userId: string; completedAt?: string }>;
      }
  >;
}

export type MessageKind =
  | "text"
  | "image"
  | "file"
  | "voice"
  | "video"
  | "sticker"
  | "poll"
  | "todo"
  | "system";

export interface MessageReaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

export interface SavedMessage {
  _id: string;
  messageId: string;
  userId: string;
  message: MessageResponse;
  savedAt: string;
}

export type AppearanceTheme =
  | "system"
  | "white"
  | "black"
  | "sunset"
  | "lavender"
  | "mint"
  | "midnight"
  | "blossom"
  | "gold";

export interface UserSettings {
  _id: string;
  userId: string;
  // Appearance & Chat Settings
  theme?: "light" | "dark" | "auto";
  appearanceTheme?: AppearanceTheme;
  language?: string;
  fontSize?: "small" | "medium" | "large";
  compactMode?: boolean;
  messagePreview?: boolean;

  // Notifications & Sounds
  notifications?: boolean;
  soundEnabled?: boolean;
  notificationSound?: "default" | "subtle" | "loud";
  notificationVibration?: boolean;
  groupNotifications?: boolean;
  mentionSound?: boolean;

  // Privacy & Security
  onlineStatus?: boolean;
  privateMessages?: "all" | "friends" | "none";
  readReceipts?: boolean;
  typingIndicator?: boolean;
  lastSeen?: boolean;
  twoFactorAuth?: boolean;
  blockUnknown?: boolean;

  // Data & Storage
  messageRetention?: "forever" | "1year" | "6months" | "3months";
  autoClearCache?: boolean;
  downloadMedia?: boolean;

  updatedAt: string;
}

export interface MessageResponse {
  _id: string;
  sender: MessageSender; // Populated on backend
  chatType: "group" | "channel" | "direct";
  chatId: string;
  kind: MessageKind;
  text: string;
  attachment?: MessageAttachment;
  poll?: MessagePoll;
  todo?: MessageTodo;
  reactions?: MessageReaction[];
  replyTo?: any;
  readBy?: { user: string; readAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const rawVal = parts.pop()?.split(";").shift();
    if (rawVal) {
      try {
        return decodeURIComponent(rawVal);
      } catch (e) {
        return rawVal;
      }
    }
  }
  return null;
};

export const setCookie = (name: string, value: string, days = 365) => {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

export const saveSettingsToCookies = (settings: Partial<UserSettings>) => {
  try {
    const existingStr = getCookie("user_settings");
    const existing = existingStr ? JSON.parse(existingStr) : {};
    const updated = { ...existing, ...settings };
    setCookie("user_settings", JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save settings to cookies:", e);
  }
};

export const getSettingsFromCookies = (): Partial<UserSettings> | null => {
  try {
    const cookie = getCookie("user_settings");
    return cookie ? JSON.parse(cookie) : null;
  } catch (e) {
    console.error("Failed to read settings from cookies:", e);
    return null;
  }
};

const BASE_URL = API_URL;

/**
 * Generic helper for type-safe API requests.
 * Automatically appends Auth and user ID headers, and handles HTTP errors.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("accessToken");

  // Try to read x-user-id from saved user state
  let userId = "";
  const chatUserStr = localStorage.getItem("chat_user");
  if (chatUserStr) {
    try {
      userId = JSON.parse(chatUserStr).id || "";
    } catch {
      // Ignore parse errors
    }
  }

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (userId) {
    headers.set("x-user-id", userId);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  let data: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data && typeof data === "object" ? data.error : data;
    throw new Error(
      errorMsg || `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export const api = {
  auth: {
    generateQrToken: () => request<{ token: string }>("/auth/qr/generate"),

    sendEmailOtp: (email: string) =>
      request<{ success: boolean; message: string }>("/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    verifyEmailOtp: (email: string, code: string) =>
      request<AuthResponse>("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),

    register: (data: RegisterRequest) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    login: (phoneOrUsername: string) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phoneOrUsername }),
      }),

    guest: () =>
      request<AuthResponse>("/auth/guest", {
        method: "POST",
      }),
  },

  users: {
    getProfile: () => request<UserProfile>("/users/profile"),

    updateProfile: (updates: Partial<UserProfile>) =>
      request<{ message: string; user: UserProfile }>("/users/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      }),

    searchUsers: (query: string, connectedOnly?: boolean) =>
      request<UserProfile[]>(
        `/users/search?query=${encodeURIComponent(query)}&connectedOnly=${!!connectedOnly}`,
      ),
  },
  chats: {
    // Combined: all chats in one request
    getAllChats: () =>
      request<{
        conversations: Conversation[];
        groups: Group[];
        channels: Channel[];
      }>("/chats/all"),

    // Channels
    getChannels: () => request<Channel[]>("/channels"),

    getChannel: (channelId: string) =>
      request<Channel>(`/channels/${channelId}`),

    createChannel: (data: {
      name: string;
      description?: string;
      type?: "public" | "private";
      memberIds?: string[];
      avatar?: string | null;
    }) =>
      request<Channel>("/channels", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Groups
    getGroups: () => request<Group[]>("/groups"),

    getGroup: (groupId: string) => request<Group>(`/groups/${groupId}`),

    joinGroup: (groupId: string) =>
      request<Group>(`/groups/${groupId}/join`, {
        method: "POST",
      }),

    createGroup: (data: {
      name: string;
      description?: string;
      type?: "public" | "private";
      memberIds?: string[];
      avatar?: string | null;
    }) =>
      request<Group>("/groups", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Conversations (DMs)
    getConversations: () => request<Conversation[]>("/conversations"),

    getConversation: (conversationId: string) =>
      request<Conversation>(`/conversations/${conversationId}`),

    createDirectMessage: (otherUserId: string) =>
      request<Conversation>("/conversations/open", {
        method: "POST",
        body: JSON.stringify({ otherUserId }),
      }),

    // Messages
    getMessages: (params: {
      chatType: "group" | "channel" | "direct";
      chatId: string;
      before?: string;
      limit?: number;
    }) => {
      const queryParts = [];
      queryParts.push(`chatType=${params.chatType}`);
      queryParts.push(`chatId=${params.chatId}`);
      if (params.before) {
        queryParts.push(`before=${encodeURIComponent(params.before)}`);
      }
      if (params.limit !== undefined) {
        queryParts.push(`limit=${params.limit}`);
      }
      const queryString = queryParts.join("&");
      return request<MessageResponse[]>(`/messages?${queryString}`);
    },

    sendMessage: (data: {
      chatType: "group" | "channel" | "direct";
      chatId: string;
      text?: string;
      kind?: MessageKind;
      replyTo?: string;
      attachment?: MessageAttachment;
      poll?: MessagePoll;
      todo?: MessageTodo;
    }) =>
      request<MessageResponse>("/messages", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    votePoll: (messageId: string, optionIndex: number) =>
      request<MessagePoll>(`/messages/${messageId}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIndex }),
      }),

    toggleTodoItem: (messageId: string, itemIndex: number) =>
      request<MessageTodo>(`/messages/${messageId}/todo/${itemIndex}/toggle`, {
        method: "POST",
      }),

    deleteMessage: (messageId: string) =>
      request<{ success: boolean; messageId: string }>(
        `/messages/${messageId}`,
        { method: "DELETE" },
      ),

    editMessage: (messageId: string, text: string) =>
      request<{ success: boolean; messageId: string; text: string; editedAt: string }>(
        `/messages/${messageId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ text }),
        },
      ),

    reactToMessage: (messageId: string, emoji: string) =>
      request<{ reactions: MessageReaction[] }>(
        `/messages/${messageId}/react`,
        {
          method: "POST",
          body: JSON.stringify({ emoji }),
        },
      ),
  },

  saved: {
    getSavedMessages: (limit?: number, offset?: number) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());
      const queryString = params.toString();
      return request<{ messages: SavedMessage[]; total: number }>(
        `/saved${queryString ? `?${queryString}` : ""}`,
      );
    },

    saveMessage: (messageId: string) =>
      request<SavedMessage>("/saved", {
        method: "POST",
        body: JSON.stringify({ messageId }),
      }),

    unsaveMessage: (messageId: string) =>
      request<{ success: boolean; messageId: string }>(`/saved/${messageId}`, {
        method: "DELETE",
      }),

    deleteSavedMessage: (savedId: string) =>
      request<{ success: boolean; id: string }>(`/saved/${savedId}`, {
        method: "DELETE",
      }),
  },

  settings: {
    getSettings: async () => {
      try {
        const data = await request<UserSettings>("/settings");
        saveSettingsToCookies(data);
        return data;
      } catch (err) {
        const fromCookies = getSettingsFromCookies();
        if (fromCookies) {
          return fromCookies as UserSettings;
        }
        throw err;
      }
    },

    updateSettings: async (updates: Partial<UserSettings>) => {
      saveSettingsToCookies(updates);
      const response = await request<{ message: string; settings: UserSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (response && response.settings) {
        saveSettingsToCookies(response.settings);
      }
      return response;
    },

    getTheme: async () => {
      try {
        const res = await request<{ theme: "light" | "dark" | "auto" }>("/settings/theme");
        saveSettingsToCookies({ theme: res.theme });
        return res;
      } catch (err) {
        const fromCookies = getSettingsFromCookies();
        if (fromCookies && fromCookies.theme) {
          return { theme: fromCookies.theme };
        }
        throw err;
      }
    },

    updateTheme: async (theme: "light" | "dark" | "auto") => {
      saveSettingsToCookies({ theme });
      return request<{ theme: "light" | "dark" | "auto" }>("/settings/theme", {
        method: "PUT",
        body: JSON.stringify({ theme }),
      });
    },

    getNotifications: async () => {
      try {
        const res = await request<{ notifications: boolean; sound: boolean }>(
          "/settings/notifications",
        );
        saveSettingsToCookies({ notifications: res.notifications, soundEnabled: res.sound });
        return res;
      } catch (err) {
        const fromCookies = getSettingsFromCookies();
        if (fromCookies) {
          return {
            notifications: fromCookies.notifications ?? true,
            sound: fromCookies.soundEnabled ?? true,
          };
        }
        throw err;
      }
    },

    updateNotifications: async (notifications: boolean, sound?: boolean) => {
      saveSettingsToCookies({ notifications, soundEnabled: sound });
      return request<{ notifications: boolean; sound: boolean }>(
        "/settings/notifications",
        {
          method: "PUT",
          body: JSON.stringify({ notifications, sound }),
        },
      );
    },

    getPrivacy: async () => {
      try {
        const res = await request<{
          onlineStatus: boolean;
          readReceipts: boolean;
          typingIndicator: boolean;
        }>("/settings/privacy");
        saveSettingsToCookies({
          onlineStatus: res.onlineStatus,
          readReceipts: res.readReceipts,
          typingIndicator: res.typingIndicator,
        });
        return res;
      } catch (err) {
        const fromCookies = getSettingsFromCookies();
        if (fromCookies) {
          return {
            onlineStatus: fromCookies.onlineStatus ?? true,
            readReceipts: fromCookies.readReceipts ?? true,
            typingIndicator: fromCookies.typingIndicator ?? true,
          };
        }
        throw err;
      }
    },

    updatePrivacy: async (data: {
      onlineStatus?: boolean;
      readReceipts?: boolean;
      typingIndicator?: boolean;
    }) => {
      saveSettingsToCookies(data);
      return request<{
        onlineStatus: boolean;
        readReceipts: boolean;
        typingIndicator: boolean;
      }>("/settings/privacy", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
  },
};
