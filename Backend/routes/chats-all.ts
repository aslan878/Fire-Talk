import { Router } from "express";
import Conversation from "../models/conversation";
import Group from "../models/group";
import Channel from "../models/channel";
import { requireUser } from "../middleware/requireUser";

const router = Router();

/**
 * GET /api/chats/all
 * Returns ALL chats (conversations + groups + channels) in a single request.
 * This eliminates 3 separate round-trips to MongoDB Atlas.
 */
router.get("/all", requireUser, async (req, res) => {
  const userId = req.userId!;

  // Run all 3 queries in PARALLEL — single network wait
  const [conversations, groups, channels] = await Promise.all([
    Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "firstName lastName username avatar status lastSeen")
      .populate("lastMessage", "text kind createdAt sender")
      .lean(),
    Group.find({ "members.user": userId })
      .sort({ updatedAt: -1 })
      .lean(),
    Channel.find({ "members.user": userId })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  res.json({ conversations, groups, channels });
});

export default router;
