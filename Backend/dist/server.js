"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const index_1 = __importDefault(require("./routes/index"));
const user_1 = __importDefault(require("./models/user"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use((0, cors_1.default)({ origin: FRONTEND_URL }));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use("/api", index_1.default);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"],
    },
});
exports.io = io;
app.set("io", io);
const userSocketCounts = new Map();
const usersInCall = new Set();
const callPartners = new Map();
function endCallForUser(userId, callId) {
    const partnerId = callPartners.get(userId);
    usersInCall.delete(userId);
    callPartners.delete(userId);
    if (partnerId) {
        usersInCall.delete(partnerId);
        callPartners.delete(partnerId);
        relayToUser(partnerId, "call:end", { callId: callId ?? "" }, userId);
    }
}
function relayToUser(targetUserId, event, payload, fromUserId) {
    io.to(targetUserId).emit(event, { ...payload, fromUserId });
}
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    const userId = socket.handshake.auth.userId;
    if (userId) {
        socket.join(userId);
        const activeSockets = userSocketCounts.get(userId) ?? 0;
        userSocketCounts.set(userId, activeSockets + 1);
        user_1.default.findByIdAndUpdate(userId, { status: "online" }).catch(console.error);
        io.emit("user_status_changed", {
            userId,
            status: "online",
            lastSeen: new Date().toISOString(),
        });
        console.log(`User ${userId} joined personal room`);
    }
    socket.on("join_chat", (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });
    socket.on("join_qr_room", (qrToken) => {
        if (qrToken && typeof qrToken === "string") {
            socket.join(`qr_auth_${qrToken}`);
            console.log(`Socket ${socket.id} joined QR auth room: qr_auth_${qrToken}`);
        }
    });
    socket.on("leave_chat", (chatId) => {
        socket.leave(chatId);
        console.log(`Socket ${socket.id} left chat ${chatId}`);
    });
    socket.on("call:invite", (payload) => {
        if (!userId || !payload?.toUserId || !payload?.callId)
            return;
        if (usersInCall.has(userId) || usersInCall.has(payload.toUserId)) {
            socket.emit("call:busy", { callId: payload.callId });
            return;
        }
        relayToUser(payload.toUserId, "call:invite", payload, userId);
    });
    socket.on("call:accept", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        usersInCall.add(userId);
        usersInCall.add(payload.toUserId);
        callPartners.set(userId, payload.toUserId);
        callPartners.set(payload.toUserId, userId);
        relayToUser(payload.toUserId, "call:accept", payload, userId);
    });
    socket.on("call:reject", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        relayToUser(payload.toUserId, "call:reject", payload, userId);
    });
    socket.on("call:end", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        endCallForUser(userId, payload.callId);
    });
    socket.on("call:busy", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        relayToUser(payload.toUserId, "call:busy", payload, userId);
    });
    socket.on("webrtc:offer", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        relayToUser(payload.toUserId, "webrtc:offer", payload, userId);
    });
    socket.on("webrtc:answer", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        relayToUser(payload.toUserId, "webrtc:answer", payload, userId);
    });
    socket.on("webrtc:ice-candidate", (payload) => {
        if (!userId || !payload?.toUserId)
            return;
        relayToUser(payload.toUserId, "webrtc:ice-candidate", payload, userId);
    });
    socket.on("disconnect", () => {
        if (userId) {
            endCallForUser(userId);
            usersInCall.delete(userId);
            const activeSockets = Math.max((userSocketCounts.get(userId) ?? 1) - 1, 0);
            if (activeSockets === 0) {
                userSocketCounts.delete(userId);
                const lastSeen = new Date();
                user_1.default.findByIdAndUpdate(userId, {
                    status: "offline",
                    lastSeen,
                }).catch(console.error);
                io.emit("user_status_changed", {
                    userId,
                    status: "offline",
                    lastSeen: lastSeen.toISOString(),
                });
            }
            else {
                userSocketCounts.set(userId, activeSockets);
            }
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});
const uri = process.env.MONGODB_URL;
if (!uri) {
    console.error("Please set MONGODB_URL in .env");
    process.exit(1);
}
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});
mongoose_1.default
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
    await user_1.default.updateMany({ status: "online" }, { status: "offline", lastSeen: new Date() });
    httpServer.listen(PORT, () => {
        console.log(`API and Socket server running on http://localhost:${PORT}`);
    });
})
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
