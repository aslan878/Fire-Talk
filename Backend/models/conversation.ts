import mongoose from "mongoose";


const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      validate: {
        validator(v: mongoose.Types.ObjectId[]) {
          return Array.isArray(v) && v.length === 2;
        },
        message: "A direct chat must have exactly 2 participants",
      },
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.pre("validate", function (this: any) {
  if (this.participants?.length === 2) {
    this.participants.sort((a: any, b: any) => String(a).localeCompare(String(b)));
  }
});

conversationSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);
