import { Router } from "express";
import UserSettings from "../models/userSettings";
import { requireUser } from "../middleware/requireUser";

const router = Router();

const allowedThemes = ["light", "dark", "auto"] as const;
const allowedPrivateMessages = ["all", "friends", "none"] as const;
const allowedFontSizes = ["small", "medium", "large"] as const;
const allowedNotificationSounds = ["default", "subtle", "loud"] as const;
const allowedMessageRetentions = [
  "forever",
  "1year",
  "6months",
  "3months",
] as const;

async function getOrCreateSettings(userId: string) {
  return UserSettings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true },
  ).lean();
}

function pickSettingsUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  // Appearance & Chat Settings
  if (allowedThemes.includes(body.theme as any)) updates.theme = body.theme;
  if (typeof body.language === "string") {
    updates.language = body.language.trim().slice(0, 16) || "en";
  }
  if (allowedFontSizes.includes(body.fontSize as any))
    updates.fontSize = body.fontSize;
  if (typeof body.compactMode === "boolean")
    updates.compactMode = body.compactMode;
  if (typeof body.messagePreview === "boolean")
    updates.messagePreview = body.messagePreview;

  // Notifications & Sounds
  if (typeof body.notifications === "boolean") {
    updates.notifications = body.notifications;
  }
  if (typeof body.soundEnabled === "boolean") {
    updates.soundEnabled = body.soundEnabled;
  }
  if (typeof body.sound === "boolean") updates.soundEnabled = body.sound;
  if (allowedNotificationSounds.includes(body.notificationSound as any)) {
    updates.notificationSound = body.notificationSound;
  }
  if (typeof body.notificationVibration === "boolean") {
    updates.notificationVibration = body.notificationVibration;
  }
  if (typeof body.groupNotifications === "boolean") {
    updates.groupNotifications = body.groupNotifications;
  }
  if (typeof body.mentionSound === "boolean") {
    updates.mentionSound = body.mentionSound;
  }

  // Privacy & Security
  if (typeof body.onlineStatus === "boolean") {
    updates.onlineStatus = body.onlineStatus;
  }
  if (typeof body.readReceipts === "boolean") {
    updates.readReceipts = body.readReceipts;
  }
  if (typeof body.typingIndicator === "boolean") {
    updates.typingIndicator = body.typingIndicator;
  }
  if (typeof body.lastSeen === "boolean") {
    updates.lastSeen = body.lastSeen;
  }
  if (typeof body.twoFactorAuth === "boolean") {
    updates.twoFactorAuth = body.twoFactorAuth;
  }
  if (typeof body.blockUnknown === "boolean") {
    updates.blockUnknown = body.blockUnknown;
  }
  if (allowedPrivateMessages.includes(body.privateMessages as any)) {
    updates.privateMessages = body.privateMessages;
  }

  // Data & Storage
  if (allowedMessageRetentions.includes(body.messageRetention as any)) {
    updates.messageRetention = body.messageRetention;
  }
  if (typeof body.autoClearCache === "boolean") {
    updates.autoClearCache = body.autoClearCache;
  }
  if (typeof body.downloadMedia === "boolean") {
    updates.downloadMedia = body.downloadMedia;
  }

  return updates;
}

router.get("/", requireUser, async (req, res, next) => {
  try {
    res.json(await getOrCreateSettings(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.put("/", requireUser, async (req, res, next) => {
  try {
    const updates = pickSettingsUpdates(req.body ?? {});
    const settings = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates, $setOnInsert: { userId: req.userId } },
      { new: true, upsert: true },
    ).lean();

    res.json({ message: "Settings updated", settings });
  } catch (err) {
    next(err);
  }
});

router.get("/theme", requireUser, async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.userId!);
    res.json({ theme: settings.theme });
  } catch (err) {
    next(err);
  }
});

router.put("/theme", requireUser, async (req, res, next) => {
  try {
    if (!allowedThemes.includes(req.body?.theme)) {
      res.status(400).json({ error: "theme must be light, dark, or auto" });
      return;
    }
    const settings = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { theme: req.body.theme }, $setOnInsert: { userId: req.userId } },
      { new: true, upsert: true },
    ).lean();
    res.json({ theme: settings.theme });
  } catch (err) {
    next(err);
  }
});

router.get("/notifications", requireUser, async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.userId!);
    res.json({
      notifications: settings.notifications,
      sound: settings.soundEnabled,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/notifications", requireUser, async (req, res, next) => {
  try {
    const updates = pickSettingsUpdates(req.body ?? {});
    const settings = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates, $setOnInsert: { userId: req.userId } },
      { new: true, upsert: true },
    ).lean();
    res.json({
      notifications: settings.notifications,
      sound: settings.soundEnabled,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/privacy", requireUser, async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.userId!);
    res.json({
      onlineStatus: settings.onlineStatus,
      readReceipts: settings.readReceipts,
      typingIndicator: settings.typingIndicator,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/privacy", requireUser, async (req, res, next) => {
  try {
    const updates = pickSettingsUpdates(req.body ?? {});
    const settings = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates, $setOnInsert: { userId: req.userId } },
      { new: true, upsert: true },
    ).lean();
    res.json({
      onlineStatus: settings.onlineStatus,
      readReceipts: settings.readReceipts,
      typingIndicator: settings.typingIndicator,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
