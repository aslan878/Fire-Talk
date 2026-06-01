import { Router } from "express";
import mongoose from "mongoose";
import Channel from "../models/channel";
import { requireUser } from "../middleware/requireUser";

const router = Router();

router.get("/", requireUser, async (req, res) => {
  const list = await Channel.find({ "members.user": req.userId })
    .sort({ updatedAt: -1 })
    .lean();
  res.json(list);
});

router.get("/:channelId", requireUser, async (req, res) => {
  const { channelId } = req.params;
  if (!mongoose.isValidObjectId(channelId)) {
    res.status(400).json({ error: "Invalid channelId" });
    return;
  }
  const channel = await Channel.findOne({
    _id: channelId,
    "members.user": req.userId,
  }).lean();
  if (!channel) {
    res.status(404).json({ error: "Channel not found or access denied" });
    return;
  }
  res.json(channel);
});

router.post("/", requireUser, async (req, res) => {
  const { name, description, type, avatar } = req.body as {
    name?: string;
    description?: string;
    type?: "public" | "private";
    avatar?: string | null;
  };
  const memberIds = (req.body.memberIds as string[] | undefined) ?? [];

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const ownerId = req.userId!;
  const userIdSet = new Set<string>([
    ownerId,
    ...memberIds.filter((id) => mongoose.isValidObjectId(id)),
  ]);
  const members = [...userIdSet].map((user) => ({
    user,
    role: user === ownerId ? ("owner" as const) : ("member" as const),
  }));

  const channel = await Channel.create({
    name: name.trim(),
    description: typeof description === "string" ? description : "",
    type: type === "public" || type === "private" ? type : "public",
    owner: ownerId,
    members,
    admins: [ownerId],
    avatar: {
      url: typeof avatar === "string" && avatar ? avatar : null,
      publicId: null,
    },
  });

  res.status(201).json(channel);
});

export default router;
