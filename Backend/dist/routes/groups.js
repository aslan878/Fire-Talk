"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const group_1 = __importDefault(require("../models/group"));
const requireUser_1 = require("../middleware/requireUser");
const router = (0, express_1.Router)();
router.get("/", requireUser_1.requireUser, async (req, res) => {
    const list = await group_1.default.find({ "members.user": req.userId })
        .sort({ updatedAt: -1 })
        .lean();
    res.json(list);
});
router.get("/:groupId", requireUser_1.requireUser, async (req, res) => {
    const { groupId } = req.params;
    if (!mongoose_1.default.isValidObjectId(groupId)) {
        res.status(400).json({ error: "Invalid groupId" });
        return;
    }
    const group = await group_1.default.findOne({
        _id: groupId,
        "members.user": req.userId,
    }).lean();
    if (!group) {
        res.status(404).json({ error: "Group not found or access denied" });
        return;
    }
    res.json(group);
});
router.post("/:groupId/join", requireUser_1.requireUser, async (req, res) => {
    const { groupId } = req.params;
    if (!mongoose_1.default.isValidObjectId(groupId)) {
        res.status(400).json({ error: "Invalid groupId" });
        return;
    }
    const group = await group_1.default.findById(groupId);
    if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
    }
    const userId = req.userId;
    const isMember = group.members.some((member) => String(member.user) === userId);
    if (!isMember) {
        group.members.push({ user: userId, role: "member" });
        await group.save();
    }
    res.json(group);
});
router.post("/", requireUser_1.requireUser, async (req, res) => {
    const { name, description, type, avatar } = req.body;
    const memberIds = req.body.memberIds ?? [];
    if (!name || typeof name !== "string") {
        res.status(400).json({ error: "Name is required" });
        return;
    }
    const ownerId = req.userId;
    const userIdSet = new Set([
        ownerId,
        ...memberIds.filter((id) => mongoose_1.default.isValidObjectId(id)),
    ]);
    const members = [...userIdSet].map((user) => ({
        user,
        role: user === ownerId ? "owner" : "member",
    }));
    const group = await group_1.default.create({
        name: name.trim(),
        description: typeof description === "string" ? description : "",
        type: type === "public" || type === "private" ? type : "private",
        owner: ownerId,
        members,
        admins: [ownerId],
        avatar: {
            url: typeof avatar === "string" && avatar ? avatar : null,
            publicId: null,
        },
    });
    res.status(201).json(group);
});
exports.default = router;
