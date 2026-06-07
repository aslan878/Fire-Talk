import React from "react";
import type {
  User,
  Message,
  MessageAttachment,
  MessageKind,
} from "../data/types";
import { useState, useRef, useEffect } from "react";
import { api } from "../services/api";
import { EmojiPicker } from "./EmojiPicker";
import { VoicePlayer } from "./VoicePlayer";
import {
  SearchIcon,
  PinIcon,
  PhoneIcon,
  VideoIcon,
  MoreIcon,
  PaperclipIcon,
  SmileIcon,
  MicIcon,
  SendIcon,
  SpotifyLogoIcon,
  SpotifyPlayIcon,
} from "./Icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBell,
  faBellSlash,
  faThumbtackSlash,
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCopy,
  faFileArrowDown,
  faPhotoFilm,
  faPoll,
  faPlus,
  faThumbtack,
  faTrash,
  faXmark,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { HighlightText } from "./HighlightText";
import {
  findMessageSearchIndices,
  getMessagePreviewLabel,
  getMessageSearchText,
  isChatMuted,
  loadPinnedIds,
  savePinnedIds,
  setChatMuted,
  QUICK_REACTIONS,
} from "../utils/chatHeader";

export interface SendMessagePayload {
  text?: string;
  kind?: MessageKind;
  attachment?: MessageAttachment;
  poll?: {
    question: string;
    options: string[];
  };
  todo?: {
    title: string;
    items:
    | string[]
    | Array<{
      text: string;
      completedBy?: Array<{ userId: string; completedAt?: string }>;
    }>;
  };
}

interface MainChatProps {
  activeChat: User;
  messages: Message[];
  users: Record<string, User>;
  dateDividerText?: string;
  onlineText?: string;
  messageInputPlaceholder?: string;
  spotifyText?: string;
  isGuest?: boolean;
  currentUserId?: string;
  onSendMessage?: (payload: SendMessagePayload) => void;
  onBack?: () => void;
  messagesLoading?: boolean;
  onToggleTodo?: (messageId: string, itemIndex: number) => void;
  onClearChat?: (chatId: string) => void;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReactToMessage?: (messageId: string, emoji: string) => Promise<void>;
  onStartCall?: (type: "audio" | "video") => void;
  isCallActive?: boolean;
}

export const MainChat: React.FC<MainChatProps> = ({
  activeChat,
  messages,
  users,
  dateDividerText,
  onlineText,
  messageInputPlaceholder,
  spotifyText,
  isGuest,
  currentUserId,
  onSendMessage,
  onBack,
  messagesLoading,
  onToggleTodo,
  onClearChat,
  onDeleteMessage,
  onReactToMessage,
  onStartCall,
  isCallActive,
}) => {
  // Get current user ID from props or localStorage
  const userId =
    currentUserId ||
    (() => {
      try {
        const user = JSON.parse(localStorage.getItem("chat_user") || "{}");
        return user.id || "";
      } catch {
        return "";
      }
    })();
  const [inputText, setInputText] = useState("");
  const [isClipOpen, setIsClipOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"poll" | "todo" | null>(
    null,
  );
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoItems, setTodoItems] = useState([""]);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [pinPanelOpen, setPinPanelOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [contextMessageId, setContextMessageId] = useState<string | null>(
    null,
  );
  const [copyToast, setCopyToast] = useState(false);
  const [pinnedPreviewDismissed, setPinnedPreviewDismissed] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  const isLockedRef = useRef(false);
  const shouldStopRecordingRef = useRef(false);
  const shouldCancelRecordingRef = useRef(false);
  const startXRef = useRef(0);
  const recordingStartRef = useRef(0);
  const isCancelledRef = useRef(false);
  const chatId = activeChat.id || "";

  // Web Audio API refs for real-time audio level analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const NUM_BARS = 24;

  const startRecording = async () => {
    try {
      shouldStopRecordingRef.current = false;
      shouldCancelRecordingRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options = { mimeType: "audio/mp4" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Set up Web Audio API analyser for real-time audio levels
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevels = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Map frequency bins to our bars count
          const bars: number[] = [];
          const binCount = dataArray.length;
          const binsPerBar = Math.max(1, Math.floor(binCount / NUM_BARS));
          for (let i = 0; i < NUM_BARS; i++) {
            let sum = 0;
            for (let j = 0; j < binsPerBar; j++) {
              const idx = i * binsPerBar + j;
              sum += idx < binCount ? dataArray[idx] : 0;
            }
            // Normalize to 0-1 range with a slight boost
            bars.push(Math.min(1, (sum / binsPerBar / 255) * 1.4));
          }
          setAudioLevels(bars);
          animFrameRef.current = requestAnimationFrame(updateLevels);
        };
        animFrameRef.current = requestAnimationFrame(updateLevels);
      } catch (audioErr) {
        console.warn("Could not set up audio analyser:", audioErr);
      }

      // Check if user already cancelled/stopped during permission prompt
      if (shouldCancelRecordingRef.current) {
        cancelRecording();
      } else if (shouldStopRecordingRef.current) {
        stopRecording();
      }
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      window.alert("Could not access microphone. Please allow microphone access.");
      setIsRecording(false);
      setIsLocked(false);
      isLockedRef.current = false;
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      shouldStopRecordingRef.current = true;
      return;
    }
    const recorder = mediaRecorderRef.current;

    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Clean up audio analyser
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels(new Array(NUM_BARS).fill(0));

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm"
      });

      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }

      if (audioBlob.size > 0 && onSendMessage && !isGuest) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          onSendMessage({
            kind: "voice",
            text: "Voice message",
            attachment: {
              url: base64Url,
              mimeType: audioBlob.type,
              fileName: `voice-${Date.now()}.${audioBlob.type.split(";")[0].split("/")[1] || "webm"}`,
              size: audioBlob.size,
              durationSec: recordingTime,
            },
          });
        };
        reader.readAsDataURL(audioBlob);
      }

      setIsRecording(false);
      setRecordingTime(0);
      setIsLocked(false);
      isLockedRef.current = false;
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      shouldCancelRecordingRef.current = true;
      return;
    }
    const recorder = mediaRecorderRef.current;

    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Clean up audio analyser
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels(new Array(NUM_BARS).fill(0));

    recorder.onstop = () => {
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
      setRecordingTime(0);
      setIsLocked(false);
      isLockedRef.current = false;
      audioChunksRef.current = [];
    };

    recorder.stop();
  };

  const handleMicStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isGuest) return;
    e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    recordingStartRef.current = Date.now();
    isLockedRef.current = false;
    isCancelledRef.current = false;
    setIsLocked(false);

    void startRecording();

    const handleRelease = (_ev: MouseEvent | TouchEvent) => {
      window.removeEventListener("mouseup", handleRelease);
      window.removeEventListener("touchend", handleRelease);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);

      if (isCancelledRef.current) return;

      const elapsed = Date.now() - recordingStartRef.current;
      if (elapsed < 350) {
        // Short click: Lock mode (stay recording)
        isLockedRef.current = true;
        setIsLocked(true);
      } else {
        // Long press release: stop and send
        stopRecording();
      }
    };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (isLockedRef.current || isCancelledRef.current) return;
      const currentX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const deltaX = currentX - startXRef.current;

      // Swipe left by 80px or more to cancel
      if (deltaX < -80) {
        isCancelledRef.current = true;
        cancelRecording();
        window.removeEventListener("mouseup", handleRelease);
        window.removeEventListener("touchend", handleRelease);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("touchmove", handleMove);
      }
    };

    window.addEventListener("mouseup", handleRelease);
    window.addEventListener("touchend", handleRelease);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove, { passive: true });
  };

  // Clean up recording state on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
      }
    };
  }, []);

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!onReactToMessage) return;
    try {
      await onReactToMessage(messageId, emoji);
    } catch (error) {
      console.error("Failed to react:", error);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!onDeleteMessage) return;
    if (!window.confirm("Delete this message for everyone?")) return;

    setDeletingIds((prev) => new Set(prev).add(messageId));
    setContextMessageId(null);
    await new Promise((r) => window.setTimeout(r, 280));

    try {
      await onDeleteMessage(messageId);
      setPinnedIds((prev) => {
        const next = prev.filter((id) => id !== messageId);
        savePinnedIds(chatId, next);
        return next;
      });
    } catch (error) {
      console.error("Failed to delete message:", error);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  useEffect(() => {
    setPinnedIds(loadPinnedIds(chatId));
    setMuted(isChatMuted(chatId));
    setSearchOpen(false);
    setSearchQuery("");
    setPinPanelOpen(false);
    setMoreMenuOpen(false);
    setContextMessageId(null);
    setPinnedPreviewDismissed(false);
  }, [chatId]);

  const searchMatchIndices = findMessageSearchIndices(messages, searchQuery);
  const activeSearchMessageIndex =
    searchMatchIndices.length > 0
      ? searchMatchIndices[
      Math.min(searchMatchIndex, searchMatchIndices.length - 1)
      ]
      : -1;
  const activeSearchMessageId =
    activeSearchMessageIndex >= 0
      ? messages[activeSearchMessageIndex]?.id
      : null;

  const pinnedMessages = pinnedIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is Message => Boolean(m));

  const scrollToMessage = (messageId: string) => {
    const el = messagesAreaRef.current?.querySelector(
      `[data-message-id="${messageId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!activeSearchMessageId) return;
    scrollToMessage(activeSearchMessageId);
  }, [activeSearchMessageId, searchQuery]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
      if (
        target instanceof Element &&
        !target.closest(".message-menu")
      ) {
        setContextMessageId(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area || !contextMessageId) return;
    const close = () => setContextMessageId(null);
    area.addEventListener("scroll", close, { passive: true });
    return () => area.removeEventListener("scroll", close);
  }, [contextMessageId]);

  const togglePin = (messageId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [messageId, ...prev];
      savePinnedIds(chatId, next);
      return next;
    });
    setPinnedPreviewDismissed(false);
  };

  const goToSearchMatch = (direction: 1 | -1) => {
    if (!searchMatchIndices.length) return;
    setSearchMatchIndex((prev) => {
      const len = searchMatchIndices.length;
      return (prev + direction + len) % len;
    });
  };

  const openSearch = () => {
    setSearchOpen(true);
    setPinPanelOpen(false);
    setMoreMenuOpen(false);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatchIndex(0);
  };

  const showCopyToast = () => {
    setCopyToast(true);
    window.setTimeout(() => setCopyToast(false), 1600);
  };

  // Scroll to bottom only when new messages arrive, not on reactions/edits
  useEffect(() => {
    if (messagesLoading || !messagesAreaRef.current) return;

    const prevLen = prevMessagesLengthRef.current;
    const grew = messages.length > prevLen;
    prevMessagesLengthRef.current = messages.length;

    if (!grew) return;

    messagesAreaRef.current.scrollTo({
      top: messagesAreaRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, messagesLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsClipOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const renderAvatarContent = (avatar: string, avatarUrl?: string | null) =>
    avatarUrl ? (
      <img src={avatarUrl} alt="" className="avatar-image" />
    ) : (
      avatar
    );

  const submitTextMessage = () => {
    const text = inputText.trim();
    if (!text || isGuest || !onSendMessage) return;
    onSendMessage({ text, kind: "text" });
    setInputText("");
  };

  const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

  const handleFilePick = (
    file: File | undefined,
    forcedKind?: "image" | "video" | "file",
  ) => {
    if (!file || isGuest || !onSendMessage) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      window.alert("File is too large. Maximum size is 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const kind =
        forcedKind ||
        (file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "file");

      onSendMessage({
        kind,
        text: kind === "file" ? file.name : "",
        attachment: {
          url: typeof reader.result === "string" ? reader.result : null,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
          size: file.size,
        },
      });
      setIsClipOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const openComposer = (mode: "poll" | "todo") => {
    setComposerMode(mode);
    setIsClipOpen(false);
  };

  const closeComposer = () => {
    setComposerMode(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setTodoTitle("");
    setTodoItems([""]);
  };

  const submitPoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!question || options.length < 2 || !onSendMessage || isGuest) return;

    onSendMessage({
      kind: "poll",
      text: question,
      poll: { question, options },
    });
    closeComposer();
  };

  const submitTodo = () => {
    const title = todoTitle.trim() || "To-Do List";
    const items = todoItems.map((item) => item.trim()).filter(Boolean);
    if (!items.length || !onSendMessage || isGuest) return;

    onSendMessage({
      kind: "todo",
      text: title,
      todo: { title, items },
    });
    closeComposer();
  };

  const handlePollVote = async (messageId: string, optionIndex: number) => {
    if (!userId) return;
    try {
      await api.chats.votePoll(messageId, optionIndex);
    } catch (error) {
      console.error("Failed to vote on poll:", error);
    }
  };

  const handleTodoToggle = async (messageId: string, itemIndex: number) => {
    if (!userId) return;
    if (onToggleTodo) {
      onToggleTodo(messageId, itemIndex);
      return;
    }
    try {
      await api.chats.toggleTodoItem(messageId, itemIndex);
    } catch (error) {
      console.error("Failed to toggle todo item:", error);
    }
  };

  const renderMessageBody = (msg: Message, highlightQuery = "") => {
    if (msg.kind === "voice" && msg.attachment?.url) {
      return (
        <VoicePlayer
          url={msg.attachment.url}
          durationSec={msg.attachment.durationSec}
          isOwn={msg.isOwn}
        />
      );
    }

    if ((msg.kind === "image" || msg.kind === "video") && msg.attachment?.url) {
      return (
        <div className="message-attachment">
          {msg.kind === "image" ? (
            <img
              src={msg.attachment.url}
              alt={msg.attachment.fileName || "Attachment"}
            />
          ) : (
            <video src={msg.attachment.url} controls />
          )}
          {msg.text && (
            <p>
              <HighlightText text={msg.text} query={highlightQuery} />
            </p>
          )}
        </div>
      );
    }

    if (msg.kind === "file" && msg.attachment) {
      return (
        <a
          className="message-file"
          href={msg.attachment.url || undefined}
          download={msg.attachment.fileName || undefined}
        >
          <FontAwesomeIcon icon={faFileArrowDown} />
          <span>
            <HighlightText
              text={msg.attachment.fileName || msg.text || "File"}
              query={highlightQuery}
            />
          </span>
        </a>
      );
    }

    if (msg.kind === "poll" && msg.poll) {
      const pollVotes = msg.poll.votes || [];
      const userVote = pollVotes.find((v) => v.userId === userId);

      return (
        <div className="message-poll">
          <strong>
            <HighlightText text={msg.poll.question} query={highlightQuery} />
          </strong>
          {msg.poll.options.map((option, i) => {
            const voteCount = pollVotes.filter(
              (v) => v.optionIndex === i,
            ).length;
            const isVoted = userVote?.optionIndex === i;
            const totalVotes = pollVotes.length;
            const percentage =
              totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

            return (
              <button
                key={`${option}-${i}`}
                type="button"
                className={`poll-option ${isVoted ? "voted" : ""}`}
                onClick={() => handlePollVote(msg.id, i)}
                style={{
                  background: isVoted
                    ? "rgba(88, 101, 242, 0.4)"
                    : "rgba(100, 100, 100, 0.1)",
                }}
              >
                <div className="poll-text">
                  <HighlightText text={option} query={highlightQuery} />
                </div>
                <div className="poll-stats">
                  {voteCount > 0 && (
                    <span>
                      {voteCount} {voteCount === 1 ? "vote" : "votes"} (
                      {percentage}%)
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (msg.kind === "todo" && msg.todo) {
      const todoItems = Array.isArray(msg.todo.items)
        ? msg.todo.items.map((item) =>
          typeof item === "string" ? { text: item, completedBy: [] } : item,
        )
        : [];

      const completedCount = todoItems.filter((item) =>
        item.completedBy?.some((c) => c.userId === userId),
      ).length;
      const totalCount = todoItems.length;
      const progressPercent =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return (
        <div className="message-todo">
          <div className="todo-header">
            <span className="todo-title">
              <HighlightText text={msg.todo.title} query={highlightQuery} />
            </span>
          </div>

          {totalCount > 0 && (
            <div className="todo-progress-container">
              <div className="todo-progress-text">
                {completedCount} of {totalCount} completed ({progressPercent}%)
              </div>
              <div className="todo-progress-bar">
                <div
                  className="todo-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="todo-items-list">
            {todoItems.map((item, i) => {
              const itemData =
                typeof item === "string"
                  ? { text: item, completedBy: [] }
                  : item;
              const isCompleted = itemData.completedBy?.some(
                (c) => c.userId === userId,
              );

              return (
                <label key={`${itemData.text}-${i}`} className="todo-item">
                  <input
                    type="checkbox"
                    className="todo-checkbox"
                    checked={isCompleted || false}
                    onChange={() => handleTodoToggle(msg.id, i)}
                  />
                  <span
                    className={`todo-item-text ${isCompleted ? "completed" : ""}`}
                  >
                    <HighlightText text={itemData.text} query={highlightQuery} />
                  </span>
                  {itemData.completedBy && itemData.completedBy.length > 0 && (
                    <div
                      className="todo-members-completed"
                      title={`${itemData.completedBy.length} user(s) completed`}
                    >
                      <span className="completion-count">
                        ({itemData.completedBy.length})
                      </span>
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    return <HighlightText text={msg.text} query={highlightQuery} />;
  };

  const renderMessageMenu = (msg: Message) => {
    if (contextMessageId !== msg.id || isGuest) return null;

    return (
      <div
        className="message-menu menu-pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {onReactToMessage && (
          <div className="message-menu-reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="message-menu-reaction-btn"
                onClick={() => {
                  void handleReact(msg.id, emoji);
                  setContextMessageId(null);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="message-menu-actions">
          <button
            type="button"
            className="ItemStyle"
            onClick={() => {
              togglePin(msg.id);
              setContextMessageId(null);
            }}
          >
            <FontAwesomeIcon icon={faThumbtack} className="menuIcon" />
            {pinnedIds.includes(msg.id) ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className="ItemStyle"
            onClick={async () => {
              await navigator.clipboard.writeText(getMessageSearchText(msg));
              showCopyToast();
              setContextMessageId(null);
            }}
          >
            <FontAwesomeIcon icon={faCopy} className="menuIcon" />
            Copy
          </button>
          {msg.isOwn && onDeleteMessage && (
            <button
              type="button"
              className="LogOutStyle"
              onClick={() => void handleDelete(msg.id)}
            >
              <FontAwesomeIcon icon={faTrash} className="menuIcon logOutIcon" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="main-chat">
      <header className={`chat-header ${searchOpen ? "chat-header--search" : ""}`}>
        {searchOpen ? (
          <div className="chat-search-bar">
            <input
              ref={searchInputRef}
              type="search"
              className="chat-search-input"
              placeholder="Search in chat"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
                if (e.key === "Enter") {
                  e.preventDefault();
                  goToSearchMatch(e.shiftKey ? -1 : 1);
                }
              }}
            />
            {searchQuery.trim() && (
              <span className="chat-search-count">
                {searchMatchIndices.length
                  ? `${searchMatchIndex + 1} / ${searchMatchIndices.length}`
                  : "0 results"}
              </span>
            )}
            <button
              type="button"
              className="chat-link"
              disabled={!searchMatchIndices.length}
              onClick={() => goToSearchMatch(-1)}
              aria-label="Previous result"
            >
              <FontAwesomeIcon icon={faChevronUp} />
            </button>
            <button
              type="button"
              className="chat-link"
              disabled={!searchMatchIndices.length}
              onClick={() => goToSearchMatch(1)}
              aria-label="Next result"
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
            <button
              type="button"
              className="chat-search-close"
              onClick={closeSearch}
              aria-label="Close search"
            >
              <FontAwesomeIcon icon={faXmark} />
              <span>Close</span>
            </button>
          </div>
        ) : (
          <>
            <div className="chat-header-user">
              {onBack && activeChat.id && (
                <button
                  className="chat-back-btn"
                  onClick={onBack}
                  aria-label="Go back to chats"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
              )}
              <div
                className="avatar"
                style={{
                  backgroundColor: activeChat.avatarColor,
                  width: "40px",
                  height: "40px",
                }}
              >
                {renderAvatarContent(activeChat.avatar, activeChat.avatarUrl)}
                {activeChat.type === "direct" &&
                  activeChat.status === "online" && (
                    <div className="avatar-online-indicator"></div>
                  )}
              </div>
              <div className="chat-header-info">
                <h2>{activeChat.name}</h2>
                <div className="chat-header-status">
                  {muted && (
                    <span className="chat-muted-badge">
                      <FontAwesomeIcon icon={faBellSlash} /> muted
                    </span>
                  )}
                  {!muted &&
                    activeChat.status === "online" &&
                    onlineText && (
                      <span style={{ color: "var(--green)" }}>{onlineText}</span>
                    )}
                  {!muted && activeChat.activity && (
                    <span>{activeChat.activity}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                className={`chat-link chat-header-btn--search ${searchOpen ? "active" : ""}`}
                onClick={openSearch}
                aria-label="Search in chat"
              >
                <SearchIcon />
              </button>

              {activeChat.type === "direct" && (
                <>
                  <button
                    type="button"
                    className="chat-link chat-header-btn--call"
                    aria-label="Voice call"
                    onClick={() => onStartCall?.("audio")}
                    disabled={isCallActive || !activeChat.userId}
                    title={isCallActive ? "Call already active" : "Audio call"}
                  >
                    <PhoneIcon />
                  </button>
                  <button
                    type="button"
                    className="chat-link chat-header-btn--video"
                    aria-label="Video call"
                    onClick={() => onStartCall?.("video")}
                    disabled={isCallActive || !activeChat.userId}
                    title={isCallActive ? "Call already active" : "Video call"}
                  >
                    <VideoIcon />
                  </button>
                </>
              )}
              <div className="chat-more-wrap" ref={moreMenuRef}>
                <button
                  type="button"
                  className={`chat-link ${moreMenuOpen ? "active" : ""}`}
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  aria-label="More actions"
                >
                  <MoreIcon />
                </button>
                {moreMenuOpen && (
                  <div className="chat-more-menu menu-pop-in">
                    <button
                      type="button"
                      className="ItemStyle chat-more-menu-item--mobile"
                      onClick={() => {
                        openSearch();
                        setMoreMenuOpen(false);
                      }}
                    >
                      <FontAwesomeIcon icon={faSearch} className="menuIcon" />
                      Search in chat
                    </button>
                    <button
                      type="button"
                      className="ItemStyle"
                      onClick={() => {
                        const next = !muted;
                        setMuted(next);
                        setChatMuted(chatId, next);
                        setMoreMenuOpen(false);
                      }}
                    >
                      <FontAwesomeIcon
                        icon={muted ? faBell : faBellSlash}
                        className="menuIcon"
                      />
                      {muted ? "Unmute notifications" : "Mute"}
                    </button>
                    {activeChat.inviteLink && (
                      <button
                        type="button"
                        className="ItemStyle"
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            activeChat.inviteLink!,
                          );
                          showCopyToast();
                          setMoreMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faCopy} className="menuIcon" />
                        Copy link
                      </button>
                    )}
                    {pinnedMessages.length > 0 && (
                      <button
                        type="button"
                        className="ItemStyle"
                        onClick={() => {
                          setPinnedIds([]);
                          savePinnedIds(chatId, []);
                          setMoreMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faThumbtackSlash} />
                        Unpin all
                      </button>
                    )}
                    <button
                      type="button"
                      className="LogOutStyle"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Clear history on this device? Messages will remain on the server.",
                          )
                        ) {
                          onClearChat?.(chatId);
                        }
                        setMoreMenuOpen(false);
                      }}
                    >
                      Clear history
                    </button>

                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {copyToast && <div className="chat-toast">Copied to clipboard</div>}

      {!searchOpen &&
        pinnedMessages.length > 0 &&
        !pinnedPreviewDismissed && (
          <button
            type="button"
            className="pinned-preview-bar"
            onClick={() => {
              setPinPanelOpen(true);
              scrollToMessage(pinnedMessages[0].id);
            }}
          >
            <PinIcon />
            <span className="pinned-preview-label">Pinned message</span>
            <span className="pinned-preview-text">
              {getMessagePreviewLabel(pinnedMessages[0])}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="pinned-preview-close"
              onClick={(e) => {
                e.stopPropagation();
                setPinnedPreviewDismissed(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setPinnedPreviewDismissed(true);
                }
              }}
              aria-label="Hide pinned preview"
            >
              <FontAwesomeIcon icon={faXmark} />
            </span>
          </button>
        )}

      {pinPanelOpen && (
        <div className="pinned-panel menu-slide-in">
          {pinnedMessages.length === 0 ? (
            <p className="pinned-panel-empty">
              No pinned messages. Right-click a message and choose Pin.
            </p>
          ) : (
            <ul className="pinned-panel-list">
              {pinnedMessages.map((msg) => {
                const sender = users[msg.userId];
                return (
                  <li key={msg.id}>
                    <button
                      type="button"
                      className="pinned-panel-item"
                      onClick={() => {
                        scrollToMessage(msg.id);
                        setPinPanelOpen(false);
                      }}
                    >
                      <span className="pinned-panel-meta">
                        {sender?.name || "User"} · {msg.timestamp}
                      </span>
                      <span className="pinned-panel-text">
                        {getMessagePreviewLabel(msg)}
                      </span>
                    </button>
                    {!isGuest && (
                      <button
                        type="button"
                        className="pinned-panel-unpin"
                        onClick={() => togglePin(msg.id)}
                        aria-label="Unpin"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="messages-area" ref={messagesAreaRef}>
        {messagesLoading ? (
          <div className="messages-loading">
            <div className="messages-loading-spinner"></div>
            <span>Loading messages...</span>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const sender = users[msg.userId];
              const msgWithCreatedAt = msg as Message & {
                createdAt?: string;
                pending?: boolean;
              };

              // Determine if we need to show a date divider before this message
              let showDivider = false;
              let dividerText = "";

              if (msgWithCreatedAt.createdAt) {
                const currentDate = new Date(msgWithCreatedAt.createdAt);
                const prevMsg = messages[index - 1] as Message & {
                  createdAt?: string;
                };
                const prevDateStr = prevMsg ? prevMsg.createdAt : null;

                if (!prevDateStr) {
                  showDivider = true;
                } else {
                  const prevDate = new Date(prevDateStr);
                  showDivider =
                    currentDate.getFullYear() !== prevDate.getFullYear() ||
                    currentDate.getMonth() !== prevDate.getMonth() ||
                    currentDate.getDate() !== prevDate.getDate();
                }

                if (showDivider) {
                  const now = new Date();
                  const today = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                  );
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  const msgDate = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    currentDate.getDate(),
                  );

                  if (msgDate.getTime() === today.getTime()) {
                    dividerText = "Today";
                  } else if (msgDate.getTime() === yesterday.getTime()) {
                    dividerText = "Yesterday";
                  } else {
                    dividerText = msgDate.toLocaleDateString([], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                  }
                }
              } else if (index === 0 && dateDividerText) {
                showDivider = true;
                dividerText = dateDividerText;
              }

              return (
                <React.Fragment key={msg.id}>
                  {showDivider && (
                    <div className="date-divider">
                      <span>{dividerText}</span>
                    </div>
                  )}
                  <div
                    data-message-id={msg.id}
                    className={`message ${msg.isOwn ? "own" : ""} ${msgWithCreatedAt.pending ? "pending" : ""} ${pinnedIds.includes(msg.id) ? "message--pinned" : ""} ${msg.id === activeSearchMessageId ? "message--search-active" : ""} ${searchQuery.trim() && searchMatchIndices.includes(index) ? "message--search-match" : ""} ${deletingIds.has(msg.id) ? "message--deleting" : ""} ${contextMessageId === msg.id ? "message--menu-open" : ""}`}
                    onContextMenu={(e) => {
                      if (isGuest) return;
                      e.preventDefault();
                      setContextMessageId((id) =>
                        id === msg.id ? null : msg.id,
                      );
                    }}
                  >
                    {!msg.isOwn && sender && (
                      <div
                        className="avatar"
                        style={{
                          backgroundColor: sender.avatarColor,
                          width: "36px",
                          height: "36px",
                        }}
                      >
                        {renderAvatarContent(sender.avatar, sender.avatarUrl)}
                      </div>
                    )}

                    <div className="message-content">
                      {renderMessageMenu(msg)}
                      <div className="message-header">
                        {!msg.isOwn && sender && (
                          <span className="message-sender">{sender.name}</span>
                        )}
                        <span className="message-time">{msg.timestamp}</span>
                      </div>

                      <div className="message-bubble">
                        {pinnedIds.includes(msg.id) && (
                          <div className="message-pinned-label">
                            <FontAwesomeIcon icon={faThumbtack} /> pinned
                          </div>
                        )}
                        {renderMessageBody(
                          msg,
                          searchQuery.trim() &&
                            searchMatchIndices.includes(index)
                            ? searchQuery
                            : "",
                        )}

                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="message-reactions">
                            {msg.reactions.map((reaction, i) => (
                              <button
                                key={`${reaction.emoji}-${i}`}
                                type="button"
                                className={`reaction ${reaction.userReacted ? "reaction--active" : ""}`}
                                onClick={() =>
                                  !isGuest && handleReact(msg.id, reaction.emoji)
                                }
                                disabled={isGuest}
                              >
                                {reaction.emoji} {reaction.count}
                              </button>
                            ))}
                          </div>
                        )}

                        {msg.embed && (
                          <div className="spotify-embed">
                            <div className="spotify-art">
                              <SpotifyLogoIcon />
                            </div>
                            <div className="spotify-info">
                              {spotifyText && (
                                <div className="spotify-icon">
                                  {spotifyText}
                                </div>
                              )}
                              <h4 className="spotify-title">
                                {msg.embed.title}
                              </h4>
                              <p className="spotify-artist">
                                {msg.embed.artist}
                              </p>
                              <div className="spotify-progress">
                                {[...Array(10)].map((_, i) => (
                                  <div key={i} className="progress-bar"></div>
                                ))}
                              </div>
                            </div>
                            <button className="play-btn">
                              <SpotifyPlayIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      <div className="message-input-area">
        {!isGuest && (
          <div className={`ClipStyle ${isClipOpen ? "open" : ""}`} ref={ref}>
            <button
              className="ItemStyle"
              type="button"
              onClick={() => mediaInputRef.current?.click()}
            >
              <FontAwesomeIcon className="menuIcon" icon={faPhotoFilm} />
              Photo or Video
            </button>
            <button
              className="ItemStyle"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FontAwesomeIcon className="menuIcon" icon={faFileArrowDown} />
              File
            </button>
            <button
              className="ItemStyle"
              type="button"
              onClick={() => openComposer("poll")}
            >
              <FontAwesomeIcon className="menuIcon" icon={faPoll} />
              Poll
            </button>
            <button
              className="ItemStyle"
              type="button"
              onClick={() => openComposer("todo")}
            >
              <FontAwesomeIcon className="menuIcon" icon={faCircleCheck} />
              To-Do List
            </button>
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleFilePick(
                  file,
                  file?.type.startsWith("video/") ? "video" : "image",
                );
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                handleFilePick(e.target.files?.[0], "file");
                e.currentTarget.value = "";
              }}
            />
          </div>
        )}
        {!isGuest && composerMode && (
          <div className="attachment-composer">
            {composerMode === "poll" ? (
              <>
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Poll question"
                />
                {pollOptions.map((option, i) => (
                  <input
                    key={i}
                    value={option}
                    onChange={(e) =>
                      setPollOptions((prev) =>
                        prev.map((item, index) =>
                          index === i ? e.target.value : item,
                        ),
                      )
                    }
                    placeholder={`Option ${i + 1}`}
                  />
                ))}
                <div className="attachment-composer-actions">
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ""])}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button type="button" onClick={closeComposer}>
                    Cancel
                  </button>
                  <button type="button" onClick={submitPoll}>
                    Send poll
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  placeholder="List title"
                />
                {todoItems.map((item, i) => (
                  <div className="todo-input-row" key={i}>
                    <input
                      value={item}
                      onChange={(e) =>
                        setTodoItems((prev) =>
                          prev.map((value, index) =>
                            index === i ? e.target.value : value,
                          ),
                        )
                      }
                      placeholder={`Task ${i + 1}`}
                    />
                    {todoItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTodoItems((prev) =>
                            prev.filter((_, index) => index !== i),
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="attachment-composer-actions">
                  <button
                    type="button"
                    onClick={() => setTodoItems((prev) => [...prev, ""])}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <button type="button" onClick={closeComposer}>
                    Cancel
                  </button>
                  <button type="button" onClick={submitTodo}>
                    Send list
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {!isGuest && isEmojiPickerOpen && (
          <EmojiPicker
            onSelectEmoji={(emoji) => {
              setInputText((prev) => prev + emoji);
            }}
            onClose={() => setIsEmojiPickerOpen(false)}
          />
        )}
        <div
          className={`message-input-container ${isGuest ? "guest-disabled" : ""} ${isRecording ? "message-input-container--recording" : ""}`}
        >
          {isRecording ? (
            <>
              <button
                type="button"
                className="voice-recording-trash-btn"
                onClick={cancelRecording}
                title="Cancel recording"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>

              <div className="voice-recording-meta">
                <span className="voice-recording-dot"></span>
                <span className="voice-recording-timer">{formatRecordingTime(recordingTime)}</span>
                {!isLocked && (
                  <span className="voice-recording-slide-hint">
                    <FontAwesomeIcon icon={faArrowLeft} className="slide-arrow" /> Slide left to cancel
                  </span>
                )}
                <div className="voice-wave-animation">
                  {audioLevels.map((level, i) => (
                    <span
                      key={i}
                      className="bar"
                      style={{
                        transform: `scaleY(${Math.max(0.08, level)})`,
                        opacity: Math.max(0.4, level),
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="voice-recording-send-btn-tg"
                onClick={stopRecording}
                title="Send"
              >
                <SendIcon />
              </button>
            </>
          ) : (
            <>
              <button
                ref={buttonRef}
                className="paperclip"
                onClick={() => !isGuest && setIsClipOpen(!isClipOpen)}
                disabled={isGuest}
              >
                <PaperclipIcon />
              </button>

              <input
                type="text"
                className="message-input"
                placeholder={
                  isGuest
                    ? "You are in Guest Mode (Read-Only)"
                    : messageInputPlaceholder || ""
                }
                disabled={isGuest}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGuest && inputText.trim()) {
                    submitTextMessage();
                  }
                }}
              />
              <div className="input-actions">
                <button
                  type="button"
                  className="emoji-picker-toggle-btn"
                  onClick={() => !isGuest && setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                  disabled={isGuest}
                  title="Select emoji"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <SmileIcon />
                </button>
                {inputText.trim() ? (
                  <button
                    className="send-btn"
                    onClick={() => {
                      submitTextMessage();
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    disabled={isGuest}
                  >
                    <SendIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseDown={handleMicStart}
                    onTouchStart={handleMicStart}
                    disabled={isGuest}
                    title="Record voice message"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <MicIcon />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};
