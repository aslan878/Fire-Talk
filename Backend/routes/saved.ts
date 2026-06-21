import { Router } from "express";
import mongoose from "mongoose";
import Conversation from "../models/conversation";
import Group from "../models/group";
import Channel from "../models/channel";
import Message from "../models/message";
import SavedMessage from "../models/savedMessage";
import { requireUser } from "../middleware/requireUser";

const router = Router();

async function canAccessMessage(userId: string, message: any): Promise<boolean> {
  const chatId = message.chatId;
  if (message.chatType === "direct") {
    return (
      (await Conversation.countDocuments({
        _id: chatId,
        participants: userId,
      }).limit(1)) > 0
    );
  }
  if (message.chatType === "group") {
    return (
      (await Group.countDocuments({
        _id: chatId,
        "members.user": userId,
      }).limit(1)) > 0
    );
  }
  if (message.chatType === "channel") {
    return (
      (await Channel.countDocuments({
        _id: chatId,
        "members.user": userId,
      }).limit(1)) > 0
    );
  }
  return false;
}

function parsePageNumber(raw: unknown, fallback: number, max?: number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return max ? Math.min(n, max) : n;
}

router.get("/", requireUser, async (req, res, next) => {
  try {
    const limit = parsePageNumber(req.query.limit, 50, 100);
    const offset = parsePageNumber(req.query.offset, 0);

    const filter = { userId: req.userId };
    const [total, items] = await Promise.all([
      SavedMessage.countDocuments(filter),
      SavedMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate({
          path: "messageId",
          match: { deletedAt: null },
          populate: {
            path: "sender",
            select: "firstName lastName username avatar",
          },
        })
        .lean(),
    ]);

    const messages = items
      .filter((item: any) => item.messageId)
      .map((item: any) => ({
        _id: item._id,
        userId: item.userId,
        messageId: item.messageId._id,
        message: item.messageId,
        savedAt: item.createdAt,
      }));

    res.json({ messages, total });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireUser, async (req, res, next) => {
  try {
    const { messageId } = req.body as { messageId?: string };
    if (!messageId || !mongoose.isValidObjectId(messageId)) {
      res.status(400).json({ error: "Valid messageId is required" });
      return;
    }

    const message = await Message.findOne({
      _id: messageId,
      deletedAt: null,
    })
      .populate("sender", "firstName lastName username avatar")
      .lean();

    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (!(await canAccessMessage(req.userId!, message))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const saved = await SavedMessage.findOneAndUpdate(
      { userId: req.userId, messageId },
      { $setOnInsert: { userId: req.userId, messageId } },
      { new: true, upsert: true },
    ).lean();

    res.status(201).json({
      _id: saved._id,
      userId: saved.userId,
      messageId: saved.messageId,
      message,
      savedAt: saved.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid saved id or message id" });
      return;
    }

    const deleted = await SavedMessage.findOneAndDelete({
      userId: req.userId,
      $or: [{ _id: id }, { messageId: id }],
    }).lean();

    if (!deleted) {
      res.status(404).json({ error: "Saved message not found" });
      return;
    }

    res.json({ success: true, id: deleted._id, messageId: deleted.messageId });
  } catch (err) {
    next(err);
  }
});

export default router;
