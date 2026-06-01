import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCamera,
  faGift,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { api } from "../services/api";

// Cute green alien avatar with red cap and blue background - matches the screenshot perfectly!
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%230066cc"/><circle cx="50" cy="78" r="28" fill="%2310b981"/><circle cx="50" cy="46" r="22" fill="%2310b981"/><path d="M 32 32 L 68 32 Q 50 14 32 32 Z" fill="%23ef4444"/><circle cx="50" cy="18" r="5" fill="%23ef4444"/><circle cx="42" cy="42" r="4" fill="white"/><circle cx="58" cy="42" r="4" fill="white"/><circle cx="42" cy="42" r="2" fill="black"/><circle cx="58" cy="42" r="2" fill="black"/><path d="M 44 54 Q 50 58 56 54" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const RU_TO_EN_MONTHS: Record<string, string> = {
  "января": "January", "февраля": "February", "марта": "March", "апреля": "April",
  "мая": "May", "июня": "June", "июля": "July", "августа": "August",
  "сентября": "September", "октября": "October", "ноября": "November", "декабря": "December"
};

interface ProfileProps {
}

const Profile: React.FC<ProfileProps> = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("16 February");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [selDay, setSelDay] = useState("16");
  const [selMonth, setSelMonth] = useState("February");
  const [selYear, setSelYear] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const chatUserStr = localStorage.getItem("chat_user");

        const data = await api.users.getProfile();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setBio(data.bio || "");
        let birthdayVal = data.birthday || "16 February";
        const birthdayParts = birthdayVal.split(" ");
        if (birthdayParts[1] && RU_TO_EN_MONTHS[birthdayParts[1]]) {
          birthdayParts[1] = RU_TO_EN_MONTHS[birthdayParts[1]];
          birthdayVal = birthdayParts.join(" ");
        }

        setBirthday(birthdayVal);
        setUsername(data.username || "");
        if (data.avatar) {
          setAvatar(data.avatar);
        } else {
          setAvatar(DEFAULT_AVATAR);
        }

        // Sync legacy localStorage keys in case other parts of the app read them
        localStorage.setItem("user_bio", data.bio || "");
        localStorage.setItem("user_birthday", birthdayVal);
        localStorage.setItem("user_username", data.username || "");
        if (data.avatar) {
          localStorage.setItem("user_avatar", data.avatar);
        }

        const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Aslan";
        if (chatUserStr) {
          try {
            const parsed = JSON.parse(chatUserStr);
            if (parsed.name !== fullName) {
              parsed.name = fullName;
              localStorage.setItem("chat_user", JSON.stringify(parsed));
              window.dispatchEvent(new Event("storage"));
            }
          } catch (e) { }
        }

      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load profile from server");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const saveProfile = async (updates: {
    firstName?: string;
    lastName?: string;
    username?: string;
    bio?: string;
    birthday?: string;
    avatar?: string | null;
  }) => {
    setSavingStatus("saving");
    setError(null);
    try {
      const chatUserStr = localStorage.getItem("chat_user");

      await api.users.updateProfile(updates);

      setSavingStatus("saved");
      setTimeout(() => setSavingStatus("idle"), 2500);

      // If name was updated, sync it with localStorage's `chat_user` so layout elements update instantly!
      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        const currentFirstName = updates.firstName !== undefined ? updates.firstName : firstName;
        const currentLastName = updates.lastName !== undefined ? updates.lastName : lastName;
        const fullName = `${currentFirstName} ${currentLastName}`.trim() || "Aslan";

        if (chatUserStr) {
          try {
            const parsed = JSON.parse(chatUserStr);
            parsed.name = fullName;
            localStorage.setItem("chat_user", JSON.stringify(parsed));
            window.dispatchEvent(new Event("storage"));
          } catch (e) { }
        }
      }

      // Sync legacy localStorage keys
      if (updates.bio !== undefined) localStorage.setItem("user_bio", updates.bio);
      if (updates.birthday !== undefined) localStorage.setItem("user_birthday", updates.birthday);
      if (updates.username !== undefined) localStorage.setItem("user_username", updates.username);
      if (updates.avatar !== undefined && updates.avatar !== null) localStorage.setItem("user_avatar", updates.avatar);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save updates");
      setSavingStatus("error");
    }
  };

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
  };

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 70) {
      setBio(val);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const triggerAvatarUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatar(base64);
        saveProfile({ avatar: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const parseBirthdayString = (bStr: string) => {
    if (!bStr) return { day: "16", month: "February", year: "" };
    const parts = bStr.split(" ");
    const day = parts[0] || "16";
    let month = parts[1] || "February";
    if (RU_TO_EN_MONTHS[month]) {
      month = RU_TO_EN_MONTHS[month];
    }
    const year = parts[2] || "";
    return { day, month, year };
  };

  const startEditingBirthday = () => {
    const { day, month, year } = parseBirthdayString(birthday);
    setSelDay(day);
    setSelMonth(month);
    setSelYear(year);
    setIsEditingBirthday(true);
  };

  const handleDayInputChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 2);
    setSelDay(clean);
    const formatted = `${clean} ${selMonth}${selYear ? ` ${selYear}` : ""}`;
    setBirthday(formatted);
    saveProfile({ birthday: formatted });
  };

  const handleMonthSelectChange = (newMonth: string) => {
    setSelMonth(newMonth);
    const formatted = `${selDay} ${newMonth}${selYear ? ` ${selYear}` : ""}`;
    setBirthday(formatted);
    saveProfile({ birthday: formatted });
  };

  const handleYearInputChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setSelYear(clean);
    const formatted = `${selDay} ${selMonth}${clean ? ` ${clean}` : ""}`;
    setBirthday(formatted);
    saveProfile({ birthday: formatted });
  };

  if (loading) {
    return (
      <div className="profile">
        <div className="profile-top-header">
          <button className="back-arrow-btn" onClick={() => navigate("/")} aria-label="Back">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <span className="profile-header-title">Edit Profile</span>
        </div>
        <div className="profile-loading-container">
          <div className="profile-spinner"></div>
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-top-header" style={{ position: "relative" }}>
        <button className="back-arrow-btn" onClick={() => navigate("/")} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span className="profile-header-title">Edit Profile</span>
        {savingStatus === "saving" && <div className="profile-saving-status">Saving...</div>}
        {savingStatus === "saved" && <div className="profile-saving-status saved">Saved</div>}
        {savingStatus === "error" && <div className="profile-saving-status error">Error</div>}
      </div>

      {error && <div className="profile-error-banner">{error}</div>}

      <div className="profile-scroll-content">
        <div className="avatar-edit-section">
          <div className="avatar-wrapper" onClick={triggerAvatarUpload}>
            <img src={avatar} alt="Avatar" className="avatar-preview-img" />
            <div className="avatar-overlay-camera">
              <div className="camera-icons-container">
                <FontAwesomeIcon icon={faCamera} className="camera-icon-main" />
                <FontAwesomeIcon icon={faPlus} className="camera-icon-plus" />
              </div>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            style={{ display: "none" }}
          />
        </div>

        <div className="profile-form-inputs">
          <div className="floating-input-group">
            <input
              type="text"
              id="first-name-input"
              value={firstName}
              onChange={handleFirstNameChange}
              onBlur={() => saveProfile({ firstName })}
              placeholder=" "
              required
            />
            <label htmlFor="first-name-input">First Name (required)</label>
          </div>

          <div className="floating-input-group">
            <input
              type="text"
              id="last-name-input"
              value={lastName}
              onChange={handleLastNameChange}
              onBlur={() => saveProfile({ lastName })}
              placeholder=" "
            />
            <label htmlFor="last-name-input">Last Name (optional)</label>
          </div>

          <div className="floating-input-group textarea-group">
            <textarea
              id="bio-input"
              value={bio}
              onChange={handleBioChange}
              onBlur={() => saveProfile({ bio })}
              placeholder=" "
              maxLength={70}
              rows={2}
            />
            <label htmlFor="bio-input">Bio</label>
            <span className="char-count-badge">{70 - bio.length}</span>
          </div>

          <p className="field-desc-text">
            Any details such as age, occupation or city. Example: 23 years old, designer from San Francisco.
          </p>

          <div className="birthday-card">
            <div className="birthday-row" onClick={startEditingBirthday} style={{ cursor: "pointer" }}>
              <div className="birthday-icon-box">
                <FontAwesomeIcon icon={faGift} />
              </div>
              <div className="birthday-details">
                <span className="birthday-title">Birthday</span>
                <span className="birthday-value">{birthday}</span>
              </div>
            </div>

            {isEditingBirthday && (
              <div className="birthday-select-container" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="Day"
                  className="birthday-input-item"
                  value={selDay}
                  onChange={(e) => handleDayInputChange(e.target.value)}
                />

                <select
                  className="birthday-select-item"
                  value={selMonth}
                  onChange={(e) => handleMonthSelectChange(e.target.value)}
                >
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Year"
                  className="birthday-input-item"
                  value={selYear}
                  onChange={(e) => handleYearInputChange(e.target.value)}
                />


              </div>
            )}
            <p className="birthday-desc-text">
              You can choose who can see your birthday in <span className="settings-highlight">Settings &gt;</span>.
            </p>
          </div>

          <div className="floating-input-group username-section">
            <input
              type="text"
              id="username-input"
              value={username}
              onChange={handleUsernameChange}
              onBlur={() => saveProfile({ username })}
              placeholder=" "
            />
            <label htmlFor="username-input">Username</label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;