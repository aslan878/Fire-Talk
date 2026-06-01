import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
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
      default: "private",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
  },
  { timestamps: true }
);

groupSchema.index({ "members.user": 1 });
groupSchema.index({ name: "text", description: "text" });

export default mongoose.model("Group", groupSchema);
