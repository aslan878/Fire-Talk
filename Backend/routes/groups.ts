import { Router } from "express";
import mongoose from "mongoose";
import Group from "../models/group";
import { requireUser } from "../middleware/requireUser";

const router = Router();

router.get("/", requireUser, async (req, res) => {
  const list = await Group.find({ "members.user": req.userId })
    .sort({ updatedAt: -1 })
    .lean();
  res.json(list);
});

router.get("/:groupId", requireUser, async (req, res) => {
  const { groupId } = req.params;
  if (!mongoose.isValidObjectId(groupId)) {
    res.status(400).json({ error: "Invalid groupId" });
    return;
  }
  const group = await Group.findOne({
    _id: groupId,
    "members.user": req.userId,
  }).lean();
  if (!group) {
    res.status(404).json({ error: "Group not found or access denied" });
    return;
  }
  res.json(group);
});

router.post("/:groupId/join", requireUser, async (req, res) => {
  const { groupId } = req.params;
  if (!mongoose.isValidObjectId(groupId)) {
    res.status(400).json({ error: "Invalid groupId" });
    return;
  }

  const group = await Group.findById(groupId);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const userId = req.userId!;
  const isMember = group.members.some(
    (member: any) => String(member.user) === userId,
  );

  if (!isMember) {
    group.members.push({ user: userId, role: "member" });
    await group.save();
  }

  res.json(group);
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

  const group = await Group.create({
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

export default router;
