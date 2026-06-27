import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBookmark,
  faFile,
  faFileArrowDown,
  faImage,
  faTrash,
  faMicrophone,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import "./Saved.css";
import { api, type SavedMessage } from "../services/api";
import { VoicePlayer } from "./VoicePlayer";
import { ChatMediaViewer, type MediaSlide } from "./ChatMediaViewer";

interface SavedProps {
  /** Called when the user wants to jump to a saved message in its original chat. */
  onGoToMessage?: (chatType: string, chatId: string, messageId: string) => void;
}

const getSenderName = (item: SavedMessage) => {
  const sender = item.message.sender;
  return (
    `${sender.firstName || ""} ${sender.lastName || ""}`.trim() ||
    sender.username ||
    "Unknown"
  );
};

const getMessageText = (item: SavedMessage) => {
  const message = item.message;
  if (message.kind === "image") return "Photo";
  if (message.kind === "video") return "Video";
  if (message.kind === "file") return message.attachment?.fileName || "File";
  if (message.kind === "voice") return "Voice message";
  if (message.kind === "poll") return message.poll?.question || "Poll";
  if (message.kind === "todo") return message.todo?.title || "To-Do List";
  return message.text || "Message";
};

const getKindIcon = (kind: string) => {
  if (kind === "image" || kind === "video") return faImage;
  if (kind === "file") return faFile;
  if (kind === "voice") return faMicrophone;
  return faBookmark;
};



const Saved = ({ onGoToMessage }: SavedProps) => {
  const navigate = useNavigate();
  const [savedItems, setSavedItems] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Media viewer
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mediaSlides: MediaSlide[] = savedItems
    .filter(
      (item) =>
        (item.message.kind === "image" || item.message.kind === "video") &&
        item.message.attachment?.url,
    )
    .map((item) => ({
      src: item.message.attachment!.url!,
      type: item.message.kind === "image" ? "image" : "video",
      mimeType: item.message.attachment?.mimeType,
      fileName: item.message.attachment?.fileName,
    }));

  const renderMediaPreview = (
    item: SavedMessage,
    onOpenMedia?: (index: number) => void,
  ) => {
    const msg = item.message;

    if (msg.kind === "voice" && msg.attachment?.url) {
      return (
        <div
          className="saved-media-preview"
          onClick={(e) => e.stopPropagation()}
        >
          <VoicePlayer
            url={msg.attachment.url}
            durationSec={msg.attachment.durationSec}
            isOwn={false}
          />
        </div>
      );
    }

    if (msg.kind === "image" && msg.attachment?.url) {
      return (
        <div
          className="saved-media-preview"
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            const idx = mediaSlides.findIndex(
              (s) => s.src === msg.attachment!.url,
            );
            if (idx >= 0) onOpenMedia?.(idx);
          }}
        >
          <img
            src={msg.attachment.url}
            alt={msg.attachment.fileName || "Image"}
          />
        </div>
      );
    }

    if (msg.kind === "video" && msg.attachment?.url) {
      return (
        <div
          className="saved-media-preview"
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            const idx = mediaSlides.findIndex(
              (s) => s.src === msg.attachment!.url,
            );
            if (idx >= 0) onOpenMedia?.(idx);
          }}
        >
          <video
            controls
            onClick={(e) => e.stopPropagation()}
            onError={(e) => console.error("Video load error:", (e.target as HTMLVideoElement).error)}
          >
            <source src={msg.attachment.url} type={msg.attachment.mimeType || "video/mp4"} />
          </video>
        </div>
      );
    }

    if (msg.kind === "file" && msg.attachment) {
      return (
        <a
          className="saved-file-link"
          href={msg.attachment.url || undefined}
          download={msg.attachment.fileName || undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <FontAwesomeIcon icon={faFileArrowDown} />
          {msg.attachment.fileName || msg.text || "Download file"}
        </a>
      );
    }

    return null;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchSavedItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.saved.getSavedMessages();
        if (!cancelled) setSavedItems(response.messages);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load saved messages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchSavedItems();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (e: React.MouseEvent, item: SavedMessage) => {
    e.stopPropagation();
    const previous = savedItems;
    setSavedItems((items) => items.filter((saved) => saved._id !== item._id));
    try {
      await api.saved.deleteSavedMessage(item._id);
    } catch (err: any) {
      setSavedItems(previous);
      setError(err.message || "Failed to remove saved message");
    }
  };

  const handleGoToMessage = (item: SavedMessage) => {
    if (!onGoToMessage) return;
    onGoToMessage(item.message.chatType, item.message.chatId, item.message._id);
    navigate("/");
  };

  return (
    <div className="saved-screen">
      <div className="saved-header">
        <button
          className="saved-back-btn"
          onClick={() => navigate("/")}
          aria-label="Back"
          type="button"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span className="saved-header-title">Saved Messages</span>
      </div>

      {error && <div className="saved-error">{error}</div>}

      <div className="saved-list">
        {loading ? (
          <div className="saved-empty">Loading saved messages...</div>
        ) : savedItems.length === 0 ? (
          <div className="saved-empty">
            <FontAwesomeIcon icon={faBookmark} />
            <span>No saved messages yet</span>
          </div>
        ) : (
          savedItems.map((item) => (
            <article
              className="saved-item"
              key={item._id}
              onClick={() => handleGoToMessage(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleGoToMessage(item);
              }}
              aria-label={`Go to message from ${getSenderName(item)}`}
            >
              <div className="saved-kind">
                <FontAwesomeIcon icon={getKindIcon(item.message.kind)} />
              </div>
              <div className="saved-content">
                <div className="saved-meta">
                  <span>{getSenderName(item)}</span>
                  <time>
                    {new Date(item.savedAt).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </div>
                <p>{getMessageText(item)}</p>

                {renderMediaPreview(item, (idx) => {
                  if (idx >= 0) {
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }
                })}

                <span className="saved-goto-badge">
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  Go to message
                </span>
              </div>
              <button
                className="saved-remove"
                onClick={(e) => void handleRemove(e, item)}
                aria-label="Remove saved message"
                type="button"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </article>
          ))
        )}
      </div>
      <ChatMediaViewer
        open={lightboxOpen}
        index={lightboxIndex}
        slides={mediaSlides}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
};

export default Saved;
