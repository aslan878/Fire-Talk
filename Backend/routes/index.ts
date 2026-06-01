import { Router } from "express";
import messagesRouter from "./messages";
import groupsRouter from "./groups";
import channelsRouter from "./channels";
import conversationsRouter from "./conversations";
import chatsAllRouter from "./chats-all";
import authRouter from "./auth";
import usersRouter from "./users";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/messages", messagesRouter);
router.use("/groups", groupsRouter);
router.use("/channels", channelsRouter);
router.use("/conversations", conversationsRouter);
router.use("/chats", chatsAllRouter);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default router;
