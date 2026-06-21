import mongoose from "mongoose";

const savedMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

savedMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export default mongoose.model("SavedMessage", savedMessageSchema);
