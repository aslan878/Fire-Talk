import type { Message, Reaction } from "../data/types";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export function formatReactionsFromApi(
  raw:
    | Array<{
        emoji: string;
        count?: number;
        userReacted?: boolean;
        users?: Array<{ user?: string | { _id?: string } }>;
      }>
    | undefined,
  currentUserId: string,
): Reaction[] {
  if (!raw?.length) return [];
  return raw.map((r) => ({
    emoji: r.emoji,
    count:
      r.count ??
      r.users?.length ??
      0,
    userReacted:
      r.userReacted ??
      r.users?.some((u) => {
        const id =
          typeof u.user === "object" && u.user?._id
            ? u.user._id
            : u.user;
        return String(id) === currentUserId;
      }) ??
      false,
  }));
}

export const pinsStorageKey = (chatId: string) => `chat_pins_${chatId}`;
export const muteStorageKey = (chatId: string) => `chat_muted_${chatId}`;

export function getMessageSearchText(msg: Message): string {
  if (msg.kind === "poll" && msg.poll) {
    return [msg.poll.question, ...msg.poll.options].join(" ");
  }
  if (msg.kind === "todo" && msg.todo) {
    const items = msg.todo.items.map((item) =>
      typeof item === "string" ? item : item.text,
    );
    return [msg.todo.title, ...items].join(" ");
  }
  if (msg.kind === "file") {
    return msg.attachment?.fileName || msg.text || "File";
  }
  if (msg.kind === "image") return msg.text || "Photo";
  if (msg.kind === "video") return msg.text || "Video";
  return msg.text || "";
}

export function getMessagePreviewLabel(msg: Message): string {
  const text = getMessageSearchText(msg).trim();
  if (text.length > 80) return `${text.slice(0, 80)}…`;
  return text || "Message";
}

export function loadPinnedIds(chatId: string): string[] {
  if (!chatId) return [];
  try {
    const raw = localStorage.getItem(pinsStorageKey(chatId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function savePinnedIds(chatId: string, ids: string[]) {
  if (!chatId) return;
  localStorage.setItem(pinsStorageKey(chatId), JSON.stringify(ids));
}

export function isChatMuted(chatId: string): boolean {
  return localStorage.getItem(muteStorageKey(chatId)) === "1";
}

export function setChatMuted(chatId: string, muted: boolean) {
  if (muted) {
    localStorage.setItem(muteStorageKey(chatId), "1");
  } else {
    localStorage.removeItem(muteStorageKey(chatId));
  }
}

export function findMessageSearchIndices(
  messages: Message[],
  query: string,
): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages.reduce<number[]>((acc, msg, index) => {
    if (getMessageSearchText(msg).toLowerCase().includes(q)) {
      acc.push(index);
    }
    return acc;
  }, []);
}
