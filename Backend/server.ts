import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import apiRouter from "./routes/index";
import uploadRouter from "./routes/upload";
import User from "./models/user";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "none");

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1gb" }));

app.use(express.urlencoded({ limit: "1gb", extended: true }));

app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/api/upload", uploadRouter);

// Health check endpoint for monitoring services
app.get("/api/health", (req, res) => {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };
  res.status(200).json(healthCheck);
});

app.use("/api", apiRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

const userSocketCounts = new Map<string, number>();
const usersInCall = new Set<string>();
const callPartners = new Map<string, string>();

function endCallForUser(userId: string, callId?: string) {
  const partnerId = callPartners.get(userId);
  usersInCall.delete(userId);
  callPartners.delete(userId);
  if (partnerId) {
    usersInCall.delete(partnerId);
    callPartners.delete(partnerId);
    relayToUser(partnerId, "call:end", { callId: callId ?? "" }, userId);
  }
}

function relayToUser(
  targetUserId: string,
  event: string,
  payload: Record<string, unknown>,
  fromUserId: string,
) {
  io.to(targetUserId).emit(event, { ...payload, fromUserId });
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  const userId = socket.handshake.auth.userId;
  if (userId) {
    socket.join(userId);
    const activeSockets = userSocketCounts.get(userId) ?? 0;
    userSocketCounts.set(userId, activeSockets + 1);
    User.findByIdAndUpdate(userId, { status: "online" }).catch(console.error);
    io.emit("user_status_changed", {
      userId,
      status: "online",
      lastSeen: new Date().toISOString(),
    });
    console.log(`User ${userId} joined personal room`);
  }
  socket.on("join_chat", (chatId: string) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  socket.on("typing", (payload: { chatId: string; username: string }) => {
    if (userId) {
      socket.to(payload.chatId).emit("user_typing", {
        chatId: payload.chatId,
        userId,
        username: payload.username,
      });
    }
  });

  socket.on("stop_typing", (payload: { chatId: string }) => {
    if (userId) {
      socket.to(payload.chatId).emit("user_stop_typing", {
        chatId: payload.chatId,
        userId,
      });
    }
  });

  socket.on("set_online_status_preference", async (payload: { onlineStatus: boolean }) => {
    if (!userId) return;
    try {
      const status = payload.onlineStatus ? "online" : "offline";
      await User.findByIdAndUpdate(userId, { status });
      io.emit("user_status_changed", {
        userId,
        status,
        lastSeen: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to update status preference:", e);
    }
  });

  socket.on("join_qr_room", (qrToken: string) => {
    if (qrToken && typeof qrToken === "string") {
      socket.join(`qr_auth_${qrToken}`);
      console.log(
        `Socket ${socket.id} joined QR auth room: qr_auth_${qrToken}`,
      );
    }
  });

  socket.on("leave_chat", (chatId: string) => {
    socket.leave(chatId);
    console.log(`Socket ${socket.id} left chat ${chatId}`);
  });

  socket.on(
    "call:invite",
    (payload: {
      callId: string;
      toUserId: string;
      fromUserName: string;
      chatId: string;
    }) => {
      if (!userId || !payload?.toUserId || !payload?.callId) return;
      if (usersInCall.has(userId) || usersInCall.has(payload.toUserId)) {
        socket.emit("call:busy", { callId: payload.callId });
        return;
      }
      relayToUser(payload.toUserId, "call:invite", payload, userId);
    },
  );

  socket.on("call:accept", (payload: { callId: string; toUserId: string }) => {
    if (!userId || !payload?.toUserId) return;
    usersInCall.add(userId);
    usersInCall.add(payload.toUserId);
    callPartners.set(userId, payload.toUserId);
    callPartners.set(payload.toUserId, userId);
    relayToUser(payload.toUserId, "call:accept", payload, userId);
  });

  socket.on("call:reject", (payload: { callId: string; toUserId: string }) => {
    if (!userId || !payload?.toUserId) return;
    relayToUser(payload.toUserId, "call:reject", payload, userId);
  });

  socket.on("call:end", (payload: { callId: string; toUserId: string }) => {
    if (!userId || !payload?.toUserId) return;
    endCallForUser(userId, payload.callId);
  });

  socket.on("call:busy", (payload: { callId: string; toUserId: string }) => {
    if (!userId || !payload?.toUserId) return;
    relayToUser(payload.toUserId, "call:busy", payload, userId);
  });

  socket.on(
    "webrtc:offer",
    (payload: { callId: string; toUserId: string; offer: unknown }) => {
      if (!userId || !payload?.toUserId) return;
      relayToUser(payload.toUserId, "webrtc:offer", payload, userId);
    },
  );

  socket.on(
    "webrtc:answer",
    (payload: { callId: string; toUserId: string; answer: unknown }) => {
      if (!userId || !payload?.toUserId) return;
      relayToUser(payload.toUserId, "webrtc:answer", payload, userId);
    },
  );

  socket.on(
    "webrtc:ice-candidate",
    (payload: { callId: string; toUserId: string; candidate: unknown }) => {
      if (!userId || !payload?.toUserId) return;
      relayToUser(payload.toUserId, "webrtc:ice-candidate", payload, userId);
    },
  );

  socket.on("disconnect", () => {
    if (userId) {
      endCallForUser(userId);
      usersInCall.delete(userId);
      const activeSockets = Math.max(
        (userSocketCounts.get(userId) ?? 1) - 1,
        0,
      );
      if (activeSockets === 0) {
        userSocketCounts.delete(userId);
        const lastSeen = new Date();
        User.findByIdAndUpdate(userId, {
          status: "offline",
          lastSeen,
        }).catch(console.error);
        io.emit("user_status_changed", {
          userId,
          status: "offline",
          lastSeen: lastSeen.toISOString(),
        });
      } else {
        userSocketCounts.set(userId, activeSockets);
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

export { io };
const uri = process.env.MONGODB_URL;
if (!uri) {
  console.error("Please set MONGODB_URL in .env");
  process.exit(1);
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

mongoose
  .connect(uri, {
    // Connection pool: default is 5, increase for parallel queries
    maxPoolSize: 20,
    minPoolSize: 5,
    // Faster timeout for slow Atlas connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    // Keep connections alive (prevents cold reconnects)
    heartbeatFrequencyMS: 10000,
  })
  .then(async () => {
    await User.updateMany(
      { status: "online" },
      { status: "offline", lastSeen: new Date() },
    );
    httpServer.listen(PORT, () => {
      console.log(`API and Socket server running on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
