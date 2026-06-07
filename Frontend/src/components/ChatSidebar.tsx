/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Tab, ChatItem } from "../data/types";
import { SearchIcon, BarsIcon } from "./Icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { api } from "../services/api";
import {
  faGear,
  faUser,
  faBookmark,
  faPlus,
  faBullhorn,
  faUsers,
  faMoon,
  faLightbulb,
  faSignOutAlt,
  faArrowLeft,
  faCamera,
  faCheck,
  faGlobe,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

interface ChatSidebarProps {
  searchPlaceholder: string;
  listTitle: string;
  tabs: Tab[];
  chats: ChatItem[];
  onLogout?: () => void;
  onSelectChat?: (chat: ChatItem) => void;
  onTabChange?: (tabId: string) => void;
  onChatCreated?: (selectChatId?: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  searchPlaceholder,
  listTitle,
  tabs,
  chats,
  onLogout,
  onSelectChat,
  onTabChange,
  onChatCreated,
}) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light";
  });

  // Screen States
  const [activeScreen, setActiveScreen] = useState<
    "main" | "channel" | "group" | "contact"
  >("main");

  const changeScreen = (screen: "main" | "channel" | "group" | "contact") => {
    setActiveScreen(screen);
    if (screen === "group" || screen === "channel") {
      loadAvailableUsers("");
      resetCreateForm();
    } else if (screen === "contact") {
      setContactQuery("");
      setSearchResults([]);
    }
  };

  // Channel/Group Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channelType, setChannelType] = useState<"public" | "private">(
    "public",
  );
  const [chatAvatar, setChatAvatar] = useState<string | null>(null);

  // Member lists selection
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");

  // Contact Search States
  const [contactQuery, setContactQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const chatAvatarInputRef = useRef<HTMLInputElement>(null);

  const getUserId = (user: any) => String(user.id || user._id || "");
  const getAvatarUrl = (avatar: any) => {
    if (!avatar) return null;
    return typeof avatar === "string" ? avatar : avatar.url || null;
  };
  const getInitial = (value?: string) =>
    (value?.trim()?.[0] || "?").toUpperCase();
  const getUserName = (user: any) =>
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.username ||
    "Unknown user";
  const getLastSeenText = (user: any) => {
    if (user.status === "online") return "online";
    if (!user.lastSeen) return "last seen recently";

    const lastSeen = new Date(user.lastSeen);
    if (Number.isNaN(lastSeen.getTime())) return "last seen recently";

    return `last seen ${lastSeen.toLocaleDateString([], {
      day: "numeric",
      month: "short",
    })}`;
  };

  const resetCreateForm = () => {
    setSelectedUserIds([]);
    setName("");
    setDescription("");
    setSearchMemberQuery("");
    setChatAvatar(null);
    if (chatAvatarInputRef.current) {
      chatAvatarInputRef.current.value = "";
    }
  };

  const renderAvatar = (
    label: string,
    color: string,
    avatarUrl?: string | null,
    className = "avatar",
  ) => (
    <div className={className} style={{ backgroundColor: color }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="avatar-image" />
      ) : (
        getInitial(label)
      )}
    </div>
  );

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("light-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Load default users when group/channel screen is opened
  const loadAvailableUsers = async (query = "") => {
    try {
      const results = await api.users.searchUsers(query);
      setAvailableUsers(results);
    } catch (error) {
      console.error("Failed to load users for group selection:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
      if (addRef.current && !addRef.current.contains(target)) {
        setIsAddOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateChannel = async () => {
    if (!name.trim()) {
      alert("Please enter a channel name");
      return;
    }
    try {
      const channel = await api.chats.createChannel({
        name: name.trim(),
        description: description.trim(),
        type: channelType,
        memberIds: selectedUserIds,
        avatar: chatAvatar,
      });
      changeScreen("main");
      if (onChatCreated) {
        onChatCreated(channel._id);
      }
    } catch (error) {
      console.error("Failed to create channel:", error);
      alert("Failed to create channel");
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      alert("Please enter a group name");
      return;
    }
    try {
      const group = await api.chats.createGroup({
        name: name.trim(),
        description: description.trim(),
        type: "private",
        memberIds: selectedUserIds,
        avatar: chatAvatar,
      });
      changeScreen("main");
      if (onChatCreated) {
        onChatCreated(group._id);
      }
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Failed to create group");
    }
  };

  const handleSearchContact = async () => {
    if (!contactQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await api.users.searchUsers(contactQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Failed to search users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddContactChat = async (userId: string) => {
    try {
      const conv = await api.chats.createDirectMessage(userId);
      changeScreen("main");
      if (onChatCreated) {
        onChatCreated(conv._id);
      }
    } catch (error) {
      console.error("Failed to start direct chat:", error);
      alert("Failed to start chat with this user");
    }
  };

  const handleChatAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setChatAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      className="chat-sidebar"
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* MAIN SCREEN */}
      {activeScreen === "main" && (
        <>
          <div className="chat-sidebar-header">
            <div className="brand-header">
              <div ref={menuRef}>
                <button
                  className="menu-btn"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <BarsIcon />
                </button>
                <div className={`menuStyle ${isMenuOpen ? "open" : ""}`}>
                  <p
                    className="ItemStyle"
                    onClick={() => {
                      navigate("/profile");
                      setIsMenuOpen(false);
                    }}
                  >
                    <FontAwesomeIcon className="menuIcon" icon={faUser} />
                    My Profile
                  </p>
                  <p className="ItemStyle">
                    <FontAwesomeIcon className="menuIcon" icon={faBookmark} />
                    Saved Messages
                  </p>
                  <p
                    className="ItemStyle"
                    onClick={() => {
                      setIsDarkMode(!isDarkMode);
                      setIsMenuOpen(false);
                    }}
                  >
                    <FontAwesomeIcon
                      className="menuIcon"
                      icon={isDarkMode ? faLightbulb : faMoon}
                    />
                    {isDarkMode ? "Light Theme" : "Dark Theme"}
                  </p>
                  <p className="ItemStyle">
                    <FontAwesomeIcon className="menuIcon" icon={faGear} />
                    Settings
                  </p>
                  {onLogout && (
                    <p
                      className="LogOutStyle"
                      onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                      }}
                    >
                      <FontAwesomeIcon
                        className="logOutIcon"
                        icon={faSignOutAlt}
                      />
                      Log Out
                    </p>
                  )}
                </div>
              </div>
              <h1 className="brand-title">Fire Talk</h1>
              <div ref={addRef}>
                <button
                  className="add-btn"
                  onClick={() => setIsAddOpen(!isAddOpen)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                <div className={`addStyle ${isAddOpen ? "open" : ""}`}>
                  <p
                    className="ItemStyle"
                    onClick={() => {
                      changeScreen("channel");
                      setIsAddOpen(false);
                    }}
                  >
                    <FontAwesomeIcon className="menuIcon" icon={faBullhorn} />
                    Create Channel
                  </p>
                  <p
                    className="ItemStyle"
                    onClick={() => {
                      changeScreen("group");
                      setIsAddOpen(false);
                    }}
                  >
                    <FontAwesomeIcon className="menuIcon" icon={faUsers} />
                    Create Group
                  </p>
                  <p
                    className="ItemStyle"
                    onClick={() => {
                      changeScreen("contact");
                      setIsAddOpen(false);
                    }}
                  >
                    <FontAwesomeIcon className="menuIcon" icon={faUser} />
                    Add Contact
                  </p>
                </div>
              </div>
            </div>

            <div className="search-container">
              <div className="search-icon">
                <SearchIcon />
              </div>
              <input
                type="text"
                className="search-input"
                placeholder={searchPlaceholder}
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
              />
            </div>

            <div className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab ${tab.isActive ? "active" : ""}`}
                  onClick={() => onTabChange && onTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="chat-list">
            {listTitle && (
              <div
                style={{
                  padding: "0 12px 8px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {listTitle}
              </div>
            )}

            {(() => {
              const filteredChats = chats.filter((chat) => {
                const q = sidebarSearchQuery.toLowerCase().trim();
                if (!q) return true;
                return (
                  chat.name.toLowerCase().includes(q) ||
                  (chat.lastMessage && chat.lastMessage.toLowerCase().includes(q))
                );
              });

              if (filteredChats.length === 0) {
                return (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    {sidebarSearchQuery.trim()
                      ? "No matching chats found"
                      : "No chats here. Click the \"+\" icon to create a channel, group, or add a contact!"}
                  </div>
                );
              }

              return filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-item ${chat.isActive ? "active" : ""}`}
                  onClick={() => onSelectChat && onSelectChat(chat)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="avatar"
                    style={{ backgroundColor: chat.avatarColor }}
                  >
                    {chat.avatarUrl ? (
                      <img
                        src={chat.avatarUrl}
                        alt=""
                        className="avatar-image"
                      />
                    ) : (
                      chat.avatar
                    )}
                    {chat.type === "direct" && chat.status === "online" && (
                      <div className="avatar-online-indicator"></div>
                    )}
                  </div>
                  <div className="chat-item-content">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{chat.name}</span>
                      <span className="chat-item-time">{chat.timestamp}</span>
                    </div>
                    <div className="chat-item-last-message">
                      {chat.lastMessage}
                    </div>
                  </div>
                  {chat.unreadCount ? (
                    <div className="unread-badge">{chat.unreadCount}</div>
                  ) : null}
                </div>
              ));
            })()}
          </div>
        </>
      )}

      {/* CREATE GROUP SCREEN */}
      {activeScreen === "group" && (
        <div className="panel-screen">
          <div className="panel-screen-header">
            <button
              className="panel-back-btn"
              onClick={() => changeScreen("main")}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <h3 className="panel-screen-title">Create Group</h3>
          </div>
          <div className="panel-screen-body">
            <div className="panel-avatar-upload-container">
              <button
                type="button"
                className="panel-avatar-upload"
                onClick={() => chatAvatarInputRef.current?.click()}
                aria-label="Choose group image"
              >
                {chatAvatar ? (
                  <img src={chatAvatar} alt="" className="panel-avatar-image" />
                ) : (
                  <FontAwesomeIcon icon={faCamera} />
                )}
                <div className="panel-avatar-plus">
                  <FontAwesomeIcon icon={faPlus} />
                </div>
              </button>
              <input
                ref={chatAvatarInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden-input"
                onChange={handleChatAvatarChange}
              />
            </div>

            <div className="panel-input-group">
              <input
                type="text"
                className="panel-input"
                placeholder="Group Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="panel-input-group">
              <input
                type="text"
                className="panel-input"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="panel-input-group" style={{ marginTop: "5px" }}>
              <input
                type="text"
                className="panel-input"
                placeholder="Search participants..."
                value={searchMemberQuery}
                onChange={(e) => {
                  setSearchMemberQuery(e.target.value);
                  loadAvailableUsers(e.target.value);
                }}
              />
            </div>

            <div className="panel-subtitle">Who would you like to invite?</div>
            <div className="panel-members-list">
              {availableUsers.length === 0 ? (
                <div className="panel-empty-list">
                  No users available to add
                </div>
              ) : (
                availableUsers.map((user) => {
                  const userId = getUserId(user);
                  const avatarUrl = getAvatarUrl(user.avatar);
                  const isChecked = selectedUserIds.includes(userId);
                  return (
                    <div
                      key={userId}
                      className="panel-member-item"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedUserIds((prev) =>
                            prev.filter((id) => id !== userId),
                          );
                        } else {
                          setSelectedUserIds((prev) => [...prev, userId]);
                        }
                      }}
                    >
                      <div className="panel-member-info">
                        {renderAvatar(
                          getUserName(user),
                          "var(--primary)",
                          avatarUrl,
                          "panel-member-avatar",
                        )}
                        <div className="panel-member-details">
                          <span className="panel-member-name">
                            {getUserName(user)}
                          </span>
                          <span className="panel-member-status">
                            {getLastSeenText(user)}
                          </span>
                        </div>
                      </div>
                      <div className="panel-checkbox-container">
                        <input
                          type="checkbox"
                          className="panel-checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button className="panel-fab" onClick={handleCreateGroup}>
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      )}

      {/* CREATE CHANNEL SCREEN */}
      {activeScreen === "channel" && (
        <div className="panel-screen">
          <div className="panel-screen-header">
            <button
              className="panel-back-btn"
              onClick={() => changeScreen("main")}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <h3 className="panel-screen-title">Create Channel</h3>
          </div>
          <div className="panel-screen-body">
            <div className="panel-avatar-upload-container">
              <button
                type="button"
                className="panel-avatar-upload"
                onClick={() => chatAvatarInputRef.current?.click()}
                aria-label="Choose channel image"
              >
                {chatAvatar ? (
                  <img src={chatAvatar} alt="" className="panel-avatar-image" />
                ) : (
                  <FontAwesomeIcon icon={faCamera} />
                )}
                <div className="panel-avatar-plus">
                  <FontAwesomeIcon icon={faPlus} />
                </div>
              </button>
              <input
                ref={chatAvatarInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden-input"
                onChange={handleChatAvatarChange}
              />
            </div>

            <div className="panel-input-group">
              <input
                type="text"
                className="panel-input"
                placeholder="Channel Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="panel-input-group">
              <input
                type="text"
                className="panel-input"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="panel-input-group">
              <label>Channel Type</label>
              <div className="panel-option-cards">
                <div
                  className={`panel-option-card ${channelType === "public" ? "active" : ""}`}
                  onClick={() => setChannelType("public")}
                >
                  <div className="panel-option-card-header">
                    <FontAwesomeIcon
                      icon={faGlobe}
                      className="panel-option-icon"
                    />
                    <span>Public Channel</span>
                  </div>
                  <p className="panel-option-card-desc">
                    Public channels can be found in search, anyone can join
                    them.
                  </p>
                </div>

                <div
                  className={`panel-option-card ${channelType === "private" ? "active" : ""}`}
                  onClick={() => setChannelType("private")}
                >
                  <div className="panel-option-card-header">
                    <FontAwesomeIcon
                      icon={faLock}
                      className="panel-option-icon"
                    />
                    <span>Private Channel</span>
                  </div>
                  <p className="panel-option-card-desc">
                    Private channels can only be joined via invite link.
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-input-group" style={{ marginTop: "5px" }}>
              <input
                type="text"
                className="panel-input"
                placeholder="Search participants..."
                value={searchMemberQuery}
                onChange={(e) => {
                  setSearchMemberQuery(e.target.value);
                  loadAvailableUsers(e.target.value);
                }}
              />
            </div>

            <div className="panel-subtitle">Invite participants</div>
            <div className="panel-members-list">
              {availableUsers.length === 0 ? (
                <div className="panel-empty-list">
                  No users available to add
                </div>
              ) : (
                availableUsers.map((user) => {
                  const userId = getUserId(user);
                  const avatarUrl = getAvatarUrl(user.avatar);
                  const isChecked = selectedUserIds.includes(userId);
                  return (
                    <div
                      key={userId}
                      className="panel-member-item"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedUserIds((prev) =>
                            prev.filter((id) => id !== userId),
                          );
                        } else {
                          setSelectedUserIds((prev) => [...prev, userId]);
                        }
                      }}
                    >
                      <div className="panel-member-info">
                        {renderAvatar(
                          getUserName(user),
                          "var(--primary)",
                          avatarUrl,
                          "panel-member-avatar",
                        )}
                        <div className="panel-member-details">
                          <span className="panel-member-name">
                            {getUserName(user)}
                          </span>
                          <span className="panel-member-status">
                            {getLastSeenText(user)}
                          </span>
                        </div>
                      </div>
                      <div className="panel-checkbox-container">
                        <input
                          type="checkbox"
                          className="panel-checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button className="panel-fab" onClick={handleCreateChannel}>
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      )}

      {/* ADD CONTACT SCREEN */}
      {activeScreen === "contact" && (
        <div className="panel-screen">
          <div className="panel-screen-header">
            <button
              className="panel-back-btn"
              onClick={() => changeScreen("main")}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <h3 className="panel-screen-title">Add Contact</h3>
          </div>
          <div className="panel-screen-body">
            <div className="panel-search-container">
              <input
                type="text"
                className="panel-input"
                placeholder="Search user"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchContact()}
              />
              <button
                className="btn btn-primary"
                onClick={handleSearchContact}
                disabled={isSearching}
                style={{
                  borderRadius: "12px",
                  padding: "10px 18px",
                  fontSize: "13.5px",
                }}
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="panel-subtitle" style={{ marginTop: "10px" }}>
              Search Results
            </div>
            <div
              className="panel-members-list"
              style={{ flex: 1, maxHeight: "none" }}
            >
              {searchResults.length === 0 ? (
                <div className="panel-empty-list">
                  {isSearching
                    ? "Searching..."
                    : "Enter username or phone number to start search"}
                </div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={getUserId(user)}
                    className="panel-member-item"
                    onClick={() => handleAddContactChat(getUserId(user))}
                  >
                    <div className="panel-member-info">
                      {renderAvatar(
                        getUserName(user),
                        "var(--primary)",
                        getAvatarUrl(user.avatar),
                        "panel-member-avatar",
                      )}
                      <div className="panel-member-details">
                        <span className="panel-member-name">
                          {getUserName(user)}
                        </span>
                        <span className="panel-member-status">
                          @{user.username || "no_username"}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--primary)",
                        fontWeight: "600",
                        paddingRight: "5px",
                      }}
                    >
                      Chat
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
