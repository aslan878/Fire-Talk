import { Router } from "express";
import User from "../models/user";
import { requireUser } from "../middleware/requireUser";

const router = Router();

// GET /api/users/profile
router.get("/profile", requireUser, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName || "",
      username: user.username || "",
      bio: user.bio || "",
      birthday: user.birthday || "",
      avatar: user.avatar?.url || null,
      status: user.status,
      lastSeen: user.lastSeen,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile
router.put("/profile", requireUser, async (req, res, next) => {
  try {
    const { firstName, lastName, username, bio, birthday, avatar } = req.body as {
      firstName?: string;
      lastName?: string;
      username?: string;
      bio?: string;
      birthday?: string;
      avatar?: string | null;
    };

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Validation
    if (firstName !== undefined) {
      if (!firstName.trim()) {
        res.status(400).json({ error: "First name is required" });
        return;
      }
      user.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      user.lastName = lastName.trim();
    }

    if (bio !== undefined) {
      if (bio.length > 70) {
        res.status(400).json({ error: "Bio cannot exceed 70 characters" });
        return;
      }
      user.bio = bio;
    }

    if (birthday !== undefined) {
      user.birthday = birthday;
    }

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (trimmedUsername && trimmedUsername !== user.username) {
        // Enforce basic username rules if set (Telegram style: minimum 5 chars)
        if (trimmedUsername.length < 5 || trimmedUsername.length > 32) {
          res.status(400).json({ error: "Username must be between 5 and 32 characters" });
          return;
        }
        
        // Check uniqueness
        const existingUser = await User.findOne({ username: trimmedUsername });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          res.status(400).json({ error: "Username is already taken" });
          return;
        }
        user.username = trimmedUsername;
      } else if (!trimmedUsername) {
        user.username = undefined;
      }
    }

    if (avatar !== undefined) {
      user.avatar = {
        url: avatar,
        publicId: null,
      };
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName || "",
        username: user.username || "",
        bio: user.bio || "",
        birthday: user.birthday || "",
        avatar: user.avatar?.url || null,
        status: user.status,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/search
router.get("/search", requireUser, async (req, res, next) => {
  try {
    const { query = "" } = req.query;
    if (typeof query !== "string") {
      res.status(400).json({ error: "Query parameter is required" });
      return;
    }

    const term = query.trim();
    const foundUsers = await User.find({
      _id: { $ne: req.userId }, // Исключаем себя
      $or: [
        { username: { $regex: term, $options: "i" } },
        { firstName: { $regex: term, $options: "i" } },
        { lastName: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } }
      ]
    }).limit(10);

    res.json(foundUsers.map(u => ({
      id: u._id,
      firstName: u.firstName,
      lastName: u.lastName || "",
      username: u.username || "",
      avatar: u.avatar?.url || null,
      status: u.status,
      lastSeen: u.lastSeen,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
