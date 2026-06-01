"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const message_1 = __importDefault(require("../models/message"));
const group_1 = __importDefault(require("../models/group"));
const channel_1 = __importDefault(require("../models/channel"));
const conversation_1 = __importDefault(require("../models/conversation"));
const user_1 = __importDefault(require("../models/user"));
const requireUser_1 = require("../middleware/requireUser");
const router = (0, express_1.Router)();
/**
 * Fast membership check using countDocuments (no full doc deserialization).
 * Returns true if user is a member of the given chat.
 */
async function isMember(userId, chatType, chatId) {
    if (chatType === "direct") {
        return (await conversation_1.default.countDocuments({ _id: chatId, participants: userId }).limit(1)) > 0;
    }
    if (chatType === "group") {
        return (await group_1.default.countDocuments({ _id: chatId, "members.user": userId }).limit(1)) > 0;
    }
    return (await channel_1.default.countDocuments({ _id: chatId, "members.user": userId }).limit(1)) > 0;
}
function parseLimit(raw, fallback, max) {
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return Math.min(n, max);
}
// ── GET messages ───────────────────────────────────────────────────
router.get("/", requireUser_1.requireUser, async (req, res) => {
    const { chatType, chatId, before } = req.query;
    if (chatType !== "group" &&
        chatType !== "channel" &&
        chatType !== "direct") {
        res
            .status(400)
            .json({ error: "Specify chatType: group | channel | direct" });
        return;
    }
    if (typeof chatId !== "string" || !mongoose_1.default.isValidObjectId(chatId)) {
        res.status(400).json({ error: "Specify a valid chatId" });
        return;
    }
    const oid = new mongoose_1.default.Types.ObjectId(chatId);
    const limit = parseLimit(req.query.limit, 50, 100);
    // Build message filter
    const filter = {
        chatType,
        chatId: oid,
        deletedAt: null,
    };
    if (typeof before === "string" && before) {
        const d = new Date(before);
        if (!Number.isNaN(d.getTime())) {
            filter.createdAt = { $lt: d };
        }
    }
    // Run membership check and message fetch in PARALLEL
    const [allowed, messages] = await Promise.all([
        isMember(req.userId, chatType, oid),
        message_1.default.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("sender", "firstName lastName username avatar")
            .lean(),
    ]);
    if (!allowed) {
        res.status(403).json({ error: "Access to this chat is denied" });
        return;
    }
    res.json(messages);
});
// ── POST message ──────────────────────────────────────────────────
router.post("/", requireUser_1.requireUser, async (req, res) => {
    const { chatType, chatId, text, kind, replyTo, attachment, } = req.body;
    if (chatType !== "group" &&
        chatType !== "channel" &&
        chatType !== "direct") {
        res
            .status(400)
            .json({ error: "chatType: group | channel | direct" });
        return;
    }
    if (!chatId || !mongoose_1.default.isValidObjectId(chatId)) {
        res.status(400).json({ error: "Valid chatId is required" });
        return;
    }
    const oid = new mongoose_1.default.Types.ObjectId(chatId);
    // Run guest-check and membership-check in PARALLEL (2 lightweight queries instead of sequential)
    const [senderUser, allowed] = await Promise.all([
        user_1.default.findById(req.userId).select("isGuest firstName lastName username avatar").lean(),
        isMember(req.userId, chatType, oid),
    ]);
    if (senderUser?.isGuest) {
        res.status(403).json({ error: "Guests are not allowed to send messages" });
        return;
    }
    if (!allowed) {
        res.status(403).json({ error: "Access to this chat is denied" });
        return;
    }
    const msg = await message_1.default.create({
        sender: req.userId,
        chatType,
        chatId: oid,
        kind: kind === "image" ||
            kind === "file" ||
            kind === "voice" ||
            kind === "video" ||
            kind === "sticker" ||
            kind === "system"
            ? kind
            : "text",
        text: typeof text === "string" ? text : "",
        replyTo: replyTo && mongoose_1.default.isValidObjectId(replyTo)
            ? new mongoose_1.default.Types.ObjectId(replyTo)
            : undefined,
        attachment: attachment && typeof attachment === "object"
            ? {
                url: typeof attachment.url === "string" ? attachment.url : null,
                mimeType: typeof attachment.mimeType === "string"
                    ? attachment.mimeType
                    : null,
                fileName: typeof attachment.fileName === "string"
                    ? attachment.fileName
                    : null,
                size: typeof attachment.size === "number" ? attachment.size : null,
                durationSec: typeof attachment.durationSec === "number"
                    ? attachment.durationSec
                    : null,
                publicId: typeof attachment.publicId === "string"
                    ? attachment.publicId
                    : null,
            }
            : undefined,
    });
    // Update conversation lastMessage and populate sender in PARALLEL
    const populatePromise = msg.populate("sender", "firstName lastName username avatar");
    if (chatType === "direct") {
        await Promise.all([
            populatePromise,
            conversation_1.default.findByIdAndUpdate(oid, {
                lastMessage: msg._id,
                lastMessageAt: msg.createdAt ?? new Date(),
            }),
        ]);
    }
    else {
        await populatePromise;
    }
    // Emit real-time message event via Socket.IO
    const io = req.app.get("io");
    if (io) {
        io.to(chatId).emit("new_message", msg);
    }
    res.status(201).json(msg);
});
exports.default = router;
