import { Router } from "express";
import mongoose from "mongoose";
import Conversation from "../models/conversation";
import { requireUser } from "../middleware/requireUser";

const router = Router();

router.get("/", requireUser, async (req, res) => {
  const list = await Conversation.find({ participants: req.userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("participants", "firstName lastName username avatar status lastSeen")
    .populate("lastMessage", "text kind createdAt sender")
    .lean();
  res.json(list);
});

router.get("/:conversationId", requireUser, async (req, res) => {
  const { conversationId } = req.params;
  if (!mongoose.isValidObjectId(conversationId)) {
    res.status(400).json({ error: "Invalid conversationId" });
    return;
  }
  const conv = await Conversation.findOne({
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

router.post("/open", requireUser, async (req, res) => {
  const { otherUserId } = req.body as { otherUserId?: string };

  if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
    res.status(400).json({ error: "otherUserId must be a valid ObjectId" });
    return;
  }
  if (otherUserId === req.userId) {
    res.status(400).json({ error: "Cannot start a chat with yourself" });
    return;
  }

  const sorted = [req.userId!, otherUserId]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => new mongoose.Types.ObjectId(id));
  let created = false;
  let conv = await Conversation.findOne({ participants: sorted });
  if (!conv) {
    conv = await Conversation.create({ participants: [req.userId!, otherUserId] });
    created = true;
  }

  await (conv as any).populate("participants", "firstName lastName username avatar status lastSeen");
  res.status(created ? 201 : 200).json(conv);
});

export default router;
