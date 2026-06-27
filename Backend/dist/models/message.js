"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    chatType: {
        type: String,
        enum: ["group", "channel", "direct"],
        required: true,
        index: true,
    },
    chatId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    kind: {
        type: String,
        enum: [
            "text",
            "image",
            "file",
            "voice",
            "video",
            "sticker",
            "poll",
            "todo",
            "system",
        ],
        default: "text",
    },
    text: {
        type: String,
        default: "",
        maxlength: 16000,
    },
    attachment: {
        url: { type: String, default: null },
        mimeType: { type: String, default: null },
        fileName: { type: String, default: null },
        size: { type: Number, default: null },
        durationSec: { type: Number, default: null },
        publicId: { type: String, default: null },
    },
    poll: {
        question: { type: String, default: "" },
        options: [{ type: String }],
        votes: [
            {
                userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
                optionIndex: { type: Number },
                votedAt: { type: Date, default: Date.now },
            },
        ],
    },
    todo: {
        title: { type: String, default: "" },
        items: [
            {
                text: { type: String },
                completedBy: [
                    {
                        userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
                        completedAt: { type: Date, default: Date.now },
                    },
                ],
            },
        ],
    },
    replyTo: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    readBy: [
        {
            user: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            readAt: { type: Date, default: Date.now },
        },
    ],
    reactions: [
        {
            emoji: { type: String, required: true },
            users: [
                {
                    user: {
                        type: mongoose_1.default.Schema.Types.ObjectId,
                        ref: "User",
                        required: true,
                    },
                    reactedAt: { type: Date, default: Date.now },
                },
            ],
        },
    ],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });
messageSchema.index({ chatType: 1, chatId: 1, deletedAt: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
exports.default = mongoose_1.default.model("Message", messageSchema);
//# sourceMappingURL=message.js.map