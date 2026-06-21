"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const channelSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 128,
    },
    description: {
        type: String,
        default: "",
        maxlength: 512,
    },
    type: {
        type: String,
        enum: ["public", "private"],
        default: "public",
    },
    owner: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    members: [
        {
            user: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
            role: {
                type: String,
                enum: ["member", "admin", "owner"],
                default: "member",
            },
            joinedAt: { type: Date, default: Date.now },
        },
    ],
    admins: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    avatar: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
    },
}, { timestamps: true });
channelSchema.index({ "members.user": 1 });
channelSchema.index({ name: "text", description: "text" });
exports.default = mongoose_1.default.model("Channel", channelSchema);
//# sourceMappingURL=channel.js.map