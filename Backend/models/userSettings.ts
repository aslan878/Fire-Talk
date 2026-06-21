import mongoose from "mongoose";

const userSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    theme: {
      type: String,
      enum: ["light", "dark", "auto"],
      default: "dark",
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    soundEnabled: {
      type: Boolean,
      default: true,
    },
    onlineStatus: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      default: "en",
      trim: true,
      maxlength: 16,
    },
    privateMessages: {
      type: String,
      enum: ["all", "friends", "none"],
      default: "all",
    },
    readReceipts: {
      type: Boolean,
      default: true,
    },
    typingIndicator: {
      type: Boolean,
      default: true,
    },
    fontSize: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    compactMode: {
      type: Boolean,
      default: false,
    },
    messagePreview: {
      type: Boolean,
      default: true,
    },
    notificationSound: {
      type: String,
      enum: ["default", "subtle", "loud"],
      default: "default",
    },
    notificationVibration: {
      type: Boolean,
      default: true,
    },
    groupNotifications: {
      type: Boolean,
      default: true,
    },
    mentionSound: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Boolean,
      default: true,
    },
    twoFactorAuth: {
      type: Boolean,
      default: false,
    },
    blockUnknown: {
      type: Boolean,
      default: false,
    },
    messageRetention: {
      type: String,
      enum: ["forever", "1year", "6months", "3months"],
      default: "forever",
    },
    autoClearCache: {
      type: Boolean,
      default: false,
    },
    downloadMedia: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("UserSettings", userSettingsSchema);
