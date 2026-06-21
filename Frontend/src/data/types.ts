export interface User {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  avatarColor: string;
  status: "online" | "offline" | "idle" | "dnd";
  lastSeen?: string;
  activity?: string;
  type?: "direct" | "group" | "channel";
  inviteLink?: string;
  userId?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

export interface SpotifyEmbed {
  title: string;
  artist: string;
  platform: string;
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

export interface MessageAttachment {
  url?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
  durationSec?: number | null;
  publicId?: string | null;
}

export interface PollPayload {
  question: string;
  options: string[];
  votes?: Array<{
    userId: string;
    optionIndex: number;
    votedAt?: string;
  }>;
}

export interface TodoPayload {
  title: string;
  items: Array<
    | string
    | {
        text: string;
        completedBy?: Array<{ userId: string; completedAt?: string }>;
      }
  >;
}

export interface ReplyQuote {
  id: string;
  text: string;
  senderName: string;
  kind?: MessageKind;
}

export interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  kind?: MessageKind;
  attachment?: MessageAttachment;
  poll?: PollPayload;
  todo?: TodoPayload;
  reactions?: Reaction[];
  embed?: SpotifyEmbed;
  replyTo?: ReplyQuote | null;
  editedAt?: string | null;
}

export interface ChatItem {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  avatarColor: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
  isActive?: boolean;
  status?: "online" | "offline" | "idle" | "dnd";
  lastSeen?: string;
  activity?: string;
  type?: "direct" | "group" | "channel";
  inviteLink?: string;
}

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  isActive?: boolean;
}

export interface VoiceChannel {
  id: string;
  name: string;
  tag: string;
  isConnected: boolean;
}

export interface NavItem {
  id: string;
  avatar: string;
  color: string;
  isLogo?: boolean;
}
