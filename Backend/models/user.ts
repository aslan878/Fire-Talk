import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 5,
      maxlength: 32,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },

    lastName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 64,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 70,
    },

    birthday: {
      type: String,
      default: "",
    },

    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    privacy: {
      lastSeen: {
        type: String,
        enum: ["everybody", "contacts", "nobody"],
        default: "everybody",
      },
      avatar: {
        type: String,
        enum: ["everybody", "contacts", "nobody"],
        default: "everybody",
      },
      phone: {
        type: String,
        enum: ["everybody", "contacts", "nobody"],
        default: "contacts",
      },
    },

    contacts: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: String,
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    isGuest: {
      type: Boolean,
      default: false,
    },
    consistsOfAChannels: [
      {
        channel: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Channel",
        },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    consistsOfAGroup: [
      {
        group: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Group",
        },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    consistsOfAContacts: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    


  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);