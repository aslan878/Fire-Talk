import { Router } from "express";
import mongoose from "mongoose";
import Message from "../models/message";
import Group from "../models/group";
import Channel from "../models/channel";
import Conversation from "../models/conversation";
import User from "../models/user";
import { requireUser } from "../middleware/requireUser";

const router = Router();

/**
 * Fast membership check using countDocuments (no full doc deserialization).
 * Returns true if user is a member of the given chat.
 */
async function isMember(
  userId: string,
  chatType: "group" | "channel" | "direct",
  chatId: mongoose.Types.ObjectId,
): Promise<boolean> {
  if (chatType === "direct") {
    return (
      (await Conversation.countDocuments({
        _id: chatId,
        participants: userId,
      }).limit(1)) > 0
    );
  }
  if (chatType === "group") {
    return (
      (await Group.countDocuments({
        _id: chatId,
        "members.user": userId,
      }).limit(1)) > 0
    );
  }
  return (
    (await Channel.countDocuments({
      _id: chatId,
      "members.user": userId,
    }).limit(1)) > 0
  );
}

function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

// ── GET messages ───────────────────────────────────────────────────
router.get("/", requireUser, async (req, res) => {
  const { chatType, chatId, before } = req.query;

  if (chatType !== "group" && chatType !== "channel" && chatType !== "direct") {
    res
      .status(400)
      .json({ error: "Specify chatType: group | channel | direct" });
    return;
  }
  if (typeof chatId !== "string" || !mongoose.isValidObjectId(chatId)) {
    res.status(400).json({ error: "Specify a valid chatId" });
    return;
  }

  const oid = new mongoose.Types.ObjectId(chatId);
  const limit = parseLimit(req.query.limit, 50, 100);

  // Build message filter
  const filter: Record<string, unknown> = {
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
    isMember(req.userId!, chatType, oid),
    Message.find(filter)
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
router.post("/", requireUser, async (req, res) => {
  const { chatType, chatId, text, kind, replyTo, attachment, poll, todo } =
    req.body as {
      chatType?: string;
      chatId?: string;
      text?: string;
      kind?: string;
      replyTo?: string;
      attachment?: Record<string, unknown>;
      poll?: Record<string, unknown>;
      todo?: Record<string, unknown>;
    };

  if (chatType !== "group" && chatType !== "channel" && chatType !== "direct") {
    res.status(400).json({ error: "chatType: group | channel | direct" });
    return;
  }
  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    res.status(400).json({ error: "Valid chatId is required" });
    return;
  }

  const oid = new mongoose.Types.ObjectId(chatId);

  // Run guest-check and membership-check in PARALLEL (2 lightweight queries instead of sequential)
  const [senderUser, allowed] = await Promise.all([
    User.findById(req.userId)
      .select("isGuest firstName lastName username avatar")
      .lean(),
    isMember(req.userId!, chatType as "group" | "channel" | "direct", oid),
  ]);

  if (senderUser?.isGuest) {
    res.status(403).json({ error: "Guests are not allowed to send messages" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Access to this chat is denied" });
    return;
  }

  const senderId = new mongoose.Types.ObjectId(req.userId!);
  const msg = await Message.create({
    sender: senderId,
    chatType,
    chatId: oid,
    kind:
      kind === "image" ||
      kind === "file" ||
      kind === "voice" ||
      kind === "video" ||
      kind === "sticker" ||
      kind === "poll" ||
      kind === "todo" ||
      kind === "system"
        ? kind
        : "text",
    text: typeof text === "string" ? text : "",
    replyTo:
      replyTo && mongoose.isValidObjectId(replyTo)
        ? new mongoose.Types.ObjectId(replyTo)
        : undefined,
    attachment:
      attachment && typeof attachment === "object"
        ? {
            url: typeof attachment.url === "string" ? attachment.url : null,
            mimeType:
              typeof attachment.mimeType === "string"
                ? attachment.mimeType
                : null,
            fileName:
              typeof attachment.fileName === "string"
                ? attachment.fileName
                : null,
            size: typeof attachment.size === "number" ? attachment.size : null,
            durationSec:
              typeof attachment.durationSec === "number"
                ? attachment.durationSec
                : null,
            publicId:
              typeof attachment.publicId === "string"
                ? attachment.publicId
                : null,
          }
        : undefined,
    poll:
      poll && typeof poll === "object"
        ? {
            question: typeof poll.question === "string" ? poll.question : "",
            options: Array.isArray(poll.options)
              ? poll.options
                  .filter(
                    (option): option is string => typeof option === "string",
                  )
                  .map((option) => option.trim())
                  .filter(Boolean)
                  .slice(0, 10)
              : [],
          }
        : undefined,
    todo:
      todo && typeof todo === "object"
        ? {
            title: typeof todo.title === "string" ? todo.title : "",
            items: Array.isArray(todo.items)
              ? todo.items
                  .filter((item): item is string => typeof item === "string")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 20)
                  .map((text) => ({ text, completedBy: [] }))
              : [],
          }
        : undefined,
  });

  // Respond immediately — sender was already loaded above (no extra populate round-trip)
  const responseBody = {
    ...msg.toObject(),
    sender: senderUser ?? {
      _id: senderId,
      firstName: "",
      lastName: "",
      username: "",
      avatar: null,
    },
  };

  res.status(201).json(responseBody);

  // Side effects after HTTP response (conversation preview + websocket)
  setImmediate(() => {
    void (async () => {
      try {
        const tasks: Promise<unknown>[] = [
          msg.populate("sender", "firstName lastName username avatar"),
        ];
        if (chatType === "direct") {
          tasks.push(
            Conversation.findByIdAndUpdate(oid, {
              lastMessage: msg._id,
              lastMessageAt: msg.createdAt ?? new Date(),
            }),
          );
        }
        const [populated] = await Promise.all(tasks);
        const io = req.app.get("io");
        if (io) {
          io.to(chatId).emit("new_message", populated ?? responseBody);
        }
      } catch (err) {
        console.error("post-message side effects failed:", err);
      }
    })();
  });
});

function formatReactionsForClient(
  reactions: Array<{
    emoji: string;
    users?: Array<{ user?: mongoose.Types.ObjectId }>;
  }> | undefined,
  userId: string,
) {
  if (!reactions?.length) return [];
  return reactions.map((r) => ({
    emoji: r.emoji,
    count: r.users?.length ?? 0,
    userReacted:
      r.users?.some((u) => u.user?.toString() === userId) ?? false,
  }));
}

// ── DELETE message (soft) ─────────────────────────────────────────
router.delete("/:messageId", requireUser, async (req, res) => {
  const { messageId } = req.params;

  if (!mongoose.isValidObjectId(messageId)) {
    res.status(400).json({ error: "Invalid messageId" });
    return;
  }

  const msg = await Message.findOne({
    _id: messageId,
    deletedAt: null,
  });
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const allowed = await isMember(
    req.userId!,
    msg.chatType as "group" | "channel" | "direct",
    msg.chatId,
  );
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (msg.sender.toString() !== req.userId) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }

  msg.deletedAt = new Date();
  await msg.save();

  const chatIdStr = msg.chatId.toString();
  const io = req.app.get("io");
  if (io) {
    io.to(chatIdStr).emit("message_deleted", {
      messageId: msg._id,
      chatId: chatIdStr,
    });
  }

  res.json({ success: true, messageId: msg._id });
});

// ── POST react to message ───────────────────────────────────────────
router.post("/:messageId/react", requireUser, async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body as { emoji?: string };

  if (!mongoose.isValidObjectId(messageId)) {
    res.status(400).json({ error: "Invalid messageId" });
    return;
  }
  if (typeof emoji !== "string" || !emoji.trim() || emoji.length > 16) {
    res.status(400).json({ error: "Valid emoji is required" });
    return;
  }

  const emojiTrimmed = emoji.trim();
  const msg = await Message.findOne({ _id: messageId, deletedAt: null });
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const allowed = await isMember(
    req.userId!,
    msg.chatType as "group" | "channel" | "direct",
    msg.chatId,
  );
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const userOid = new mongoose.Types.ObjectId(req.userId!);
  const reactions = msg.reactions ?? [];
  const existing = reactions.find((r) => r.emoji === emojiTrimmed);
  const hadReaction = existing?.users?.some(
    (u) => u.user?.toString() === req.userId,
  );

  for (const group of reactions) {
    const users = group.users ?? [];
    for (let i = users.length - 1; i >= 0; i -= 1) {
      if (users[i].user?.toString() === req.userId) {
        users.splice(i, 1);
      }
    }
  }

  if (!hadReaction) {
    const target = reactions.find((r) => r.emoji === emojiTrimmed);
    if (target) {
      target.users = target.users ?? [];
      target.users.push({ user: userOid, reactedAt: new Date() });
    } else {
      reactions.push({
        emoji: emojiTrimmed,
        users: [{ user: userOid, reactedAt: new Date() }],
      });
    }
  }

  msg.set(
    "reactions",
    reactions.filter((r) => (r.users?.length ?? 0) > 0),
  );

  msg.markModified("reactions");
  await msg.save();

  const payload = formatReactionsForClient(msg.reactions, req.userId!);
  const io = req.app.get("io");
  if (io) {
    io.to(msg.chatId.toString()).emit("reaction_updated", {
      messageId: msg._id,
      reactions: payload,
    });
  }

  res.json({ reactions: payload });
});

// ── POST vote on poll ─────────────────────────────────────────────
router.post("/:messageId/vote", requireUser, async (req, res) => {
  const { messageId } = req.params;
  const { optionIndex } = req.body as { optionIndex?: number };

  if (!mongoose.isValidObjectId(messageId)) {
    res.status(400).json({ error: "Invalid messageId" });
    return;
  }

  if (typeof optionIndex !== "number" || optionIndex < 0) {
    res.status(400).json({ error: "Valid optionIndex is required" });
    return;
  }

  const msg = await Message.findById(messageId);
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  if (!msg.poll) {
    res.status(400).json({ error: "This message is not a poll" });
    return;
  }

  if (optionIndex >= msg.poll.options.length) {
    res.status(400).json({ error: "Option index out of range" });
    return;
  }

  // Check if user already voted for this option
  const existingVote = msg.poll.votes?.find(
    (v) => v.userId?.toString() === req.userId && v.optionIndex === optionIndex,
  );

  if (existingVote) {
    // Remove vote
    msg.set(
      "poll.votes",
      msg.poll.votes?.filter(
        (v) =>
          !(
            v.userId?.toString() === req.userId &&
            v.optionIndex === optionIndex
          ),
      ),
    );
  } else {
    // Remove previous vote from this user and add new vote
    msg.set(
      "poll.votes",
      msg.poll.votes?.filter((v) => v.userId?.toString() !== req.userId) || [],
    );
    msg.poll.votes.push({
      userId: new mongoose.Types.ObjectId(req.userId!),
      optionIndex,
      votedAt: new Date(),
    });
  }

  await msg.save();

  // Emit real-time poll update via Socket.IO
  const io = req.app.get("io");
  if (io) {
    io.to(msg.chatId.toString()).emit("poll_updated", {
      messageId: msg._id,
      poll: msg.poll,
    });
  }

  res.json(msg.poll);
});

// ── POST toggle todo item ─────────────────────────────────────────
router.post(
  "/:messageId/todo/:itemIndex/toggle",
  requireUser,
  async (req, res) => {
    const { messageId, itemIndex } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      res.status(400).json({ error: "Invalid messageId" });
      return;
    }

    const index = Number(itemIndex);
    if (!Number.isFinite(index) || index < 0) {
      res.status(400).json({ error: "Valid itemIndex is required" });
      return;
    }

    const msg = await Message.findById(messageId);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (!msg.todo) {
      res.status(400).json({ error: "This message is not a todo list" });
      return;
    }

    if (index >= msg.todo.items.length) {
      res.status(400).json({ error: "Item index out of range" });
      return;
    }

    const item = msg.todo.items[index];
    const userIdStr = req.userId!;

    // Check if user already completed this item
    const alreadyCompleted = item.completedBy?.some(
      (c) => c.userId?.toString() === userIdStr,
    );

    if (alreadyCompleted) {
      // Remove completion
      item.set(
        "completedBy",
        item.completedBy?.filter((c) => c.userId?.toString() !== userIdStr) ||
          [],
      );
    } else {
      // Add completion
      item.completedBy = item.completedBy || [];
      item.completedBy.push({
        userId: new mongoose.Types.ObjectId(userIdStr),
        completedAt: new Date(),
      });
    }

    msg.markModified("todo");
    await msg.save();

    // Emit real-time todo update via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(msg.chatId.toString()).emit("todo_updated", {
        messageId: msg._id,
        todo: msg.todo,
      });
    }

    res.json(msg.todo);
  },
);

export default router;
