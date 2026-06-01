import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
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
      type: mongoose.Schema.Types.ObjectId,
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
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
              userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
              completedAt: { type: Date, default: Date.now },
            },
          ],
        },
      ],
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],

    reactions: [
      {
        emoji: { type: String, required: true },
        users: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
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
  },
  { timestamps: true },
);

messageSchema.index({ chatType: 1, chatId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
