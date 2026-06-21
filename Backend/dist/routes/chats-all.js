"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversation_1 = __importDefault(require("../models/conversation"));
const group_1 = __importDefault(require("../models/group"));
const channel_1 = __importDefault(require("../models/channel"));
const requireUser_1 = require("../middleware/requireUser");
const router = (0, express_1.Router)();
/**
 * GET /api/chats/all
 * Returns ALL chats (conversations + groups + channels) in a single request.
 * This eliminates 3 separate round-trips to MongoDB Atlas.
 */
router.get("/all", requireUser_1.requireUser, async (req, res) => {
    const userId = req.userId;
    // Run all 3 queries in PARALLEL — single network wait
    const [conversations, groups, channels] = await Promise.all([
        conversation_1.default.find({ participants: userId })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate("participants", "firstName lastName username avatar status lastSeen")
            .populate("lastMessage", "text kind createdAt sender")
            .lean(),
        group_1.default.find({ "members.user": userId })
            .sort({ updatedAt: -1 })
            .lean(),
        channel_1.default.find({ "members.user": userId })
            .sort({ updatedAt: -1 })
            .lean(),
    ]);
    res.json({ conversations, groups, channels });
});
exports.default = router;
//# sourceMappingURL=chats-all.js.map