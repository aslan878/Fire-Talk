"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const conversation_1 = __importDefault(require("../models/conversation"));
const requireUser_1 = require("../middleware/requireUser");
const router = (0, express_1.Router)();
router.get("/", requireUser_1.requireUser, async (req, res) => {
    const list = await conversation_1.default.find({ participants: req.userId })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .populate("participants", "firstName lastName username avatar status lastSeen")
        .populate("lastMessage", "text kind createdAt sender")
        .lean();
    res.json(list);
});
router.get("/:conversationId", requireUser_1.requireUser, async (req, res) => {
    const { conversationId } = req.params;
    if (!mongoose_1.default.isValidObjectId(conversationId)) {
        res.status(400).json({ error: "Invalid conversationId" });
        return;
    }
    const conv = await conversation_1.default.findOne({
        _id: conversationId,
        participants: req.userId,
    })
        .populate("participants", "firstName lastName username avatar status lastSeen")
        .lean();
    if (!conv) {
        res.status(404).json({ error: "Chat not found or access denied" });
        return;
    }
    res.json(conv);
});
router.post("/open", requireUser_1.requireUser, async (req, res) => {
    const { otherUserId } = req.body;
    if (!otherUserId || !mongoose_1.default.isValidObjectId(otherUserId)) {
        res.status(400).json({ error: "otherUserId must be a valid ObjectId" });
        return;
    }
    if (otherUserId === req.userId) {
        res.status(400).json({ error: "Cannot start a chat with yourself" });
        return;
    }
    const sorted = [req.userId, otherUserId]
        .sort((a, b) => a.localeCompare(b))
        .map((id) => new mongoose_1.default.Types.ObjectId(id));
    let created = false;
    let conv = await conversation_1.default.findOne({ participants: sorted });
    if (!conv) {
        conv = await conversation_1.default.create({ participants: [req.userId, otherUserId] });
        created = true;
    }
    await conv.populate("participants", "firstName lastName username avatar status lastSeen");
    res.status(created ? 201 : 200).json(conv);
});
exports.default = router;
