"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_1 = __importDefault(require("../models/user"));
const conversation_1 = __importDefault(require("../models/conversation"));
const group_1 = __importDefault(require("../models/group"));
const requireUser_1 = require("../middleware/requireUser");
const router = (0, express_1.Router)();
// GET /api/users/profile
router.get("/profile", requireUser_1.requireUser, async (req, res, next) => {
    try {
        const user = await user_1.default.findById(req.userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName || "",
            username: user.username || "",
            bio: user.bio || "",
            birthday: user.birthday || "",
            avatar: user.avatar?.url || null,
            status: user.status,
            lastSeen: user.lastSeen,
        });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/users/profile
router.put("/profile", requireUser_1.requireUser, async (req, res, next) => {
    try {
        const { firstName, lastName, username, bio, birthday, avatar } = req.body;
        const user = await user_1.default.findById(req.userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        // Validation
        if (firstName !== undefined) {
            if (!firstName.trim()) {
                res.status(400).json({ error: "First name is required" });
                return;
            }
            user.firstName = firstName.trim();
        }
        if (lastName !== undefined) {
            user.lastName = lastName.trim();
        }
        if (bio !== undefined) {
            if (bio.length > 70) {
                res.status(400).json({ error: "Bio cannot exceed 70 characters" });
                return;
            }
            user.bio = bio;
        }
        if (birthday !== undefined) {
            user.birthday = birthday;
        }
        if (username !== undefined) {
            const trimmedUsername = username.trim();
            if (trimmedUsername && trimmedUsername !== user.username) {
                // Enforce basic username rules if set (Telegram style: minimum 5 chars)
                if (trimmedUsername.length < 5 || trimmedUsername.length > 32) {
                    res.status(400).json({ error: "Username must be between 5 and 32 characters" });
                    return;
                }
                // Check uniqueness
                const existingUser = await user_1.default.findOne({ username: trimmedUsername });
                if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                    res.status(400).json({ error: "Username is already taken" });
                    return;
                }
                user.username = trimmedUsername;
            }
            else if (!trimmedUsername) {
                user.username = undefined;
            }
        }
        if (avatar !== undefined) {
            user.avatar = {
                url: avatar,
                publicId: null,
            };
        }
        await user.save();
        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName || "",
                username: user.username || "",
                bio: user.bio || "",
                birthday: user.birthday || "",
                avatar: user.avatar?.url || null,
                status: user.status,
                lastSeen: user.lastSeen,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/users/search
router.get("/search", requireUser_1.requireUser, async (req, res, next) => {
    try {
        const { query = "", connectedOnly = "false" } = req.query;
        if (typeof query !== "string") {
            res.status(400).json({ error: "Query parameter is required" });
            return;
        }
        const term = query.trim();
        let queryCond = {
            _id: { $ne: req.userId }, // Exclude self
        };
        if (connectedOnly === "true") {
            // Find all conversations the user is in
            const conversations = await conversation_1.default.find({ participants: req.userId }).select("participants").lean();
            // Find all groups the user is in
            const groups = await group_1.default.find({ "members.user": req.userId }).select("members.user").lean();
            const connectedUserIds = new Set();
            conversations.forEach((c) => {
                c.participants.forEach((p) => {
                    if (p && p.toString() !== req.userId) {
                        connectedUserIds.add(p.toString());
                    }
                });
            });
            groups.forEach((g) => {
                g.members.forEach((m) => {
                    if (m && m.user && m.user.toString() !== req.userId) {
                        connectedUserIds.add(m.user.toString());
                    }
                });
            });
            queryCond._id = { $in: Array.from(connectedUserIds) };
        }
        if (term) {
            queryCond.$or = [
                { username: { $regex: term, $options: "i" } },
                { firstName: { $regex: term, $options: "i" } },
                { lastName: { $regex: term, $options: "i" } },
                { email: { $regex: term, $options: "i" } },
                { phone: { $regex: term, $options: "i" } }
            ];
        }
        const foundUsers = await user_1.default.find(queryCond).limit(50);
        res.json(foundUsers.map(u => ({
            id: u._id,
            firstName: u.firstName,
            lastName: u.lastName || "",
            username: u.username || "",
            avatar: u.avatar?.url || null,
            status: u.status,
            lastSeen: u.lastSeen,
        })));
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map