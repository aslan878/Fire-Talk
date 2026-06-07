import React, { useState, useMemo, useEffect, useRef } from "react";

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys & Emotion",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🫨", "🫠", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃"
    ]
  },
  {
    name: "Gestures & Body",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋", "🩸"
    ]
  },
  {
    name: "Hearts & Love",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌"
    ]
  },
  {
    name: "Animals & Nature",
    icon: "🐱",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🐙", "🦑", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐈", "🍀", "🌸", "🌹", "🌺", "🌻", "🍁", "🍁", "🍂", "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "🌾", "🍃", "🍄"
    ]
  },
  {
    name: "Food & Drink",
    icon: "🍔",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🌮", "🌯", "🥗", "🥘", "🍲", "🫕", "🥫", "🍝", "🍜", "🍣", "🍤", "🍢", "🍙", "🍚", "🍛", "🍡", "🍮", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍩", "🍪", "🍿", "🍯", "🥛", "☕", "🍵", "🥤", "🧋", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🍾", "🧊"
    ]
  },
  {
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🏹", "🎣", "🤿", "🥊", "🥋", "🥅", "⛳", "⛸️", "🛷", "🥌", "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎫", "🎟️", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🎸", "🪕", "🎻", "🎲", "🎯", "🎳", "🎮", "🎰", "🧩"
    ]
  }
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        !target?.closest(".emoji-picker-toggle-btn")
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();

    // We don't have descriptive names for each emoji, but we can return all matching emojis
    // or just return emojis from categories if we match category names, 
    // or we can search through a flat list of emojis.
    // To make search work really well, let's keep all emojis in a flat list.
    const allEmojis = EMOJI_CATEGORIES.flatMap(c => c.emojis);
    // Let's filter emojis. Since we don't have descriptions, a text search without descriptions 
    // is tricky. But wait! We can have a small mapping of common names for search, or we can just 
    // support filtering by matching a few keywords. 
    // Let's map emojis to some common keywords, or search by category name.
    // Alternatively, a quick keyword map of popular emojis makes search incredibly functional:
    const keywords: Record<string, string> = {
      "smile": "😀😃😄😁😆😅😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪",
      "laugh": "😄😆😅😂🤣😸😹",
      "love": "😍🥰😘❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥❤️‍🩹❣️💕💞💓💗💖💘💝💟",
      "heart": "❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥❤️‍🩹❣️💕💞💓💗💖💘💝💟",
      "thumbs": "👍👎",
      "yes": "👍👌✅✔️",
      "no": "👎❌❎✖️",
      "fire": "🔥❤️‍🔥",
      "ok": "👌🆗",
      "clap": "👏",
      "wave": "👋",
      "celebrate": "🥳🎉🎊🎈🥳🤩🎆🎇",
      "party": "🥳🎉🎊🎈🥳🤩",
      "sad": "😞😔😟😕🙁☹️😣😖😫😩🥺😢😭💔😿",
      "cry": "😢😭😿😭",
      "angry": "😤😠😡🤬👿👿😾",
      "devil": "😈👿",
      "cat": "🐱🐈🐈‍⬛😸😹😻😼😽🙀😿😾",
      "dog": "🐶🐕🐩🦮🐕‍🦺",
      "star": "⭐🌟💫✨🌠",
      "food": "🍎🍊🍋🍌🍉🍇🍓🍔🍟🍕🥪🌮🌯 Salad Sushi Cake Cookie ☕🍺🍷 cocktail",
      "drink": "☕🍵🥤🧋🍺🍻🥂🍷🥃🍸🍹🍾🧊",
      "beer": "🍺🍻",
      "coffee": "☕",
      "music": "🎵🎶🎹🎸🎻🎷🥁🎺🎤🎧🎼",
      "sport": "⚽🏀🏈⚾🥎🎾🏐🏉🎱🏓",
      "car": "🚗🚕🚙🏎️🚨"
    };

    const matches = allEmojis.filter(emoji => {
      // Direct emoji check (if user types the emoji itself)
      if (emoji === q) return true;
      // Search keywords
      for (const [key, val] of Object.entries(keywords)) {
        if (key.includes(q) && val.includes(emoji)) {
          return true;
        }
      }
      return false;
    });

    return matches.length > 0 ? matches : allEmojis.slice(0, 40); // fallback to first 40 if no match
  }, [searchQuery]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    setSearchQuery(""); // clear search when switching tabs

    // Scroll category into view
    const categoryEl = categoriesRef.current?.children[index] as HTMLElement;
    if (categoryEl) {
      categoryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  return (
    <div className="emoji-picker-popover" ref={pickerRef}>
      {!searchQuery && (
        <div className="emoji-picker-tabs">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              className={`emoji-picker-tab-btn ${activeTab === idx ? "active" : ""}`}
              onClick={() => handleTabClick(idx)}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      <div className="emoji-picker-content" ref={categoriesRef}>
        {searchQuery ? (
          <div className="emoji-picker-grid-wrapper">
            <div className="emoji-picker-category-title">Search Results</div>
            <div className="emoji-picker-grid">
              {filteredEmojis?.map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  type="button"
                  className="emoji-picker-emoji-btn"
                  onClick={() => onSelectEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : (
          EMOJI_CATEGORIES.map((cat, idx) => (
            <div
              key={cat.name}
              className={`emoji-picker-grid-wrapper ${activeTab === idx ? "active" : "hidden-category"}`}
            >
              <div className="emoji-picker-category-title">{cat.name}</div>
              <div className="emoji-picker-grid">
                {cat.emojis.map((emoji, eIdx) => (
                  <button
                    key={`${emoji}-${eIdx}`}
                    type="button"
                    className="emoji-picker-emoji-btn"
                    onClick={() => onSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
