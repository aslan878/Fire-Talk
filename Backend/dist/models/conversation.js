"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const conversationSchema = new mongoose_1.default.Schema({
    participants: {
        type: [
            {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        validate: {
            validator(v) {
                return Array.isArray(v) && v.length === 2;
            },
            message: "A direct chat must have exactly 2 participants",
        },
    },
    lastMessage: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    lastMessageAt: { type: Date, default: null },
}, { timestamps: true });
conversationSchema.pre("validate", function () {
    if (this.participants?.length === 2) {
        this.participants.sort((a, b) => String(a).localeCompare(String(b)));
    }
});
conversationSchema.index({ participants: 1 }, { unique: true });
exports.default = mongoose_1.default.model("Conversation", conversationSchema);
