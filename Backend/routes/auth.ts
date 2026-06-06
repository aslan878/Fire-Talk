import { Router } from "express";
import crypto from "crypto";
import User from "../models/user";
import cacheService from "../services/redis";
import { generateTokens, verifyAccessToken } from "../services/jwt";
import { sendOtpEmail } from "../services/email";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { phone, email, firstName, lastName, username } = req.body as {
      phone?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      username?: string;
    };

    if ((!phone || typeof phone !== "string" || !phone.trim()) && (!email || typeof email !== "string" || !email.trim())) {
      res.status(400).json({ error: "Phone number or email is required" });
      return;
    }
    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      res.status(400).json({ error: "First name is required" });
      return;
    }

    const trimmedPhone = phone ? phone.trim() : "";
    const trimmedEmail = email ? email.trim().toLowerCase() : "";
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = typeof lastName === "string" ? lastName.trim() : "";
    const trimmedUsername = typeof username === "string" ? username.trim() : "";

    let user = null;
    if (trimmedEmail) {
      user = await User.findOne({ email: trimmedEmail });
    } else if (trimmedPhone) {
      user = await User.findOne({ phone: trimmedPhone });
    }

    if (user) {
      if (trimmedUsername && trimmedUsername !== user.username) {
        const existingUsername = await User.findOne({ username: trimmedUsername });
        if (existingUsername && existingUsername._id.toString() !== user._id.toString()) {
          res.status(400).json({ error: "This username is already taken" });
          return;
        }
      }

      user.firstName = trimmedFirstName;
      user.lastName = trimmedLastName;
      if (trimmedUsername) {
        user.username = trimmedUsername;
      }
      user.status = "online";
      await user.save();
    } else {
      if (trimmedPhone) {
        const existingPhone = await User.findOne({ phone: trimmedPhone });
        if (existingPhone) {
          res.status(400).json({ error: "This phone number is already registered" });
          return;
        }
      }

      if (trimmedEmail) {
        const existingEmail = await User.findOne({ email: trimmedEmail });
        if (existingEmail) {
          res.status(400).json({ error: "This email is already registered" });
          return;
        }
      }

      if (trimmedUsername) {
        const existingUsername = await User.findOne({ username: trimmedUsername });
        if (existingUsername) {
          res.status(400).json({ error: "This username is already taken" });
          return;
        }
      }

      user = await User.create({
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        username: trimmedUsername || undefined,
        status: "online",
      });
    }

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.status(201).json({
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { phoneOrUsername } = req.body as { phoneOrUsername?: string };

    if (!phoneOrUsername || typeof phoneOrUsername !== "string" || !phoneOrUsername.trim()) {
      res.status(400).json({ error: "Please enter your phone number, email, or username" });
      return;
    }

    const term = phoneOrUsername.trim();

    const user = await User.findOne({
      $or: [{ phone: term }, { email: term.toLowerCase() }, { username: term }],
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    user.status = "online";
    await user.save();

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/phone/send", async (req, res, next) => {
  res.status(400).json({ error: "Phone number login is temporarily unavailable. Please log in using Email." });
});

router.post("/phone/verify", async (req, res, next) => {
  res.status(400).json({ error: "Phone number login is temporarily unavailable. Please log in using Email." });
});

router.post("/email/send", async (req, res, next) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpCode = crypto.randomInt(100000, 999999).toString();

    const otpData = {
      code: otpCode,
      attempts: 3,
    };
    await cacheService.setEx(`otp:email:${cleanEmail}`, 300, JSON.stringify(otpData));

    if (process.env.EMAIL_DELIVERY === "log") {
      console.log("[EMAIL SENDER] EMAIL_DELIVERY=log, skipping SMTP send.");
    } else {
      await sendOtpEmail(cleanEmail, otpCode);
    }

    console.log("\n==============================================");
    console.log(`[EMAIL SENDER] OTP Code for ${cleanEmail} is: \x1b[36m${otpCode}\x1b[0m`);
    console.log("==============================================\n");

    res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    next(err);
  }
});

router.post("/email/verify", async (req, res, next) => {
  try {
    const { email, code } = req.body as { email?: string; code?: string };

    if (!email || !code) {
      res.status(400).json({ error: "Email and verification code are required" });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cacheKey = `otp:email:${cleanEmail}`;

    const cachedData = await cacheService.get(cacheKey);
    if (!cachedData) {
      res.status(400).json({ error: "Code has expired or was not sent. Please request a new code." });
      return;
    }

    const otpData = JSON.parse(cachedData) as { code: string; attempts: number };

    if (otpData.attempts <= 0) {
      res.status(400).json({ error: "Maximum attempts exceeded. Please request a new code." });
      return;
    }

    if (otpData.code !== code) {
      otpData.attempts -= 1;

      if (otpData.attempts <= 0) {
        await cacheService.del(cacheKey);
        res.status(400).json({ error: "Invalid code. Attempts exhausted." });
      } else {
        const remainingTtl = await cacheService.ttl(cacheKey);
        await cacheService.setEx(
          cacheKey,
          remainingTtl > 0 ? remainingTtl : 300,
          JSON.stringify(otpData)
        );
        res.status(400).json({ error: `Invalid code. Attempts remaining: ${otpData.attempts}` });
      }
      return;
    }

    await cacheService.del(cacheKey);

    let user = await User.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        email: cleanEmail,
        firstName: `User_${cleanEmail.split("@")[0]}`,
        lastName: "",
        status: "online",
      });
    } else {
      user.status = "online";
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.json({
      success: true,
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/qr/generate", async (req, res, next) => {
  try {
    const qrToken = crypto.randomBytes(32).toString("hex");

    const qrSession = {
      status: "pending",
      userId: null,
    };
    await cacheService.setEx(`qr:${qrToken}`, 600, JSON.stringify(qrSession));

    res.json({ token: qrToken });
  } catch (err) {
    next(err);
  }
});

router.get("/qr/status/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const cacheKey = `qr:${token}`;

    const sessionData = await cacheService.get(cacheKey);
    if (!sessionData) {
      res.status(404).json({ error: "QR session not found or expired." });
      return;
    }

    const session = JSON.parse(sessionData) as { status: string; userId: string | null };

    if (session.status === "confirmed" && session.userId) {
      const user = await User.findById(session.userId);
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

      await cacheService.del(cacheKey);

      res.json({
        status: "confirmed",
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        },
        accessToken,
        refreshToken,
      });
      return;
    }

    res.json({ status: session.status });
  } catch (err) {
    next(err);
  }
});

router.post("/qr/confirm", async (req, res, next) => {
  try {
    const { token, userId: bodyUserId } = req.body as { token?: string; userId?: string };

    if (!token) {
      res.status(400).json({ error: "QR Token is required" });
      return;
    }

    const cacheKey = `qr:${token}`;
    const sessionData = await cacheService.get(cacheKey);
    if (!sessionData) {
      res.status(400).json({ error: "QR session not found or expired." });
      return;
    }

    const session = JSON.parse(sessionData) as { status: string; userId: string | null };
    if (session.status !== "pending") {
      res.status(400).json({ error: "This QR code has already been confirmed or used." });
      return;
    }

    let finalUserId: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwtToken = authHeader.split(" ")[1];
      const decoded = verifyAccessToken(jwtToken);
      if (decoded) {
        finalUserId = decoded.userId;
      }
    }

    if (!finalUserId && bodyUserId) {
      finalUserId = bodyUserId;
    }

    if (!finalUserId) {
      let demoUser = await User.findOne({ phone: "+77777777777" });
      if (!demoUser) {
        demoUser = await User.create({
          phone: "+77777777777",
          firstName: "Demo",
          lastName: "User",
          username: "demouser",
          isGuest: false,
          status: "online",
        });
      }
      finalUserId = demoUser._id.toString();
    }

    const user = await User.findById(finalUserId);
    if (!user) {
      res.status(404).json({ error: "User for confirmation not found in database." });
      return;
    }

    session.status = "confirmed";
    session.userId = user._id.toString();
    await cacheService.setEx(cacheKey, 60, JSON.stringify(session));

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    const io = req.app.get("io");
    if (io) {
      console.log(`[SOCKET] Emitting qr_success to room: qr_auth_${token}`);
      io.to(`qr_auth_${token}`).emit("qr_success", {
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
        },
        accessToken,
        refreshToken,
      });
    }

    res.json({ success: true, message: "QR code successfully confirmed." });
  } catch (err) {
    next(err);
  }
});

router.post("/guest", async (req, res, next) => {
  try {
    let user = await User.findOne({ phone: "+00000000000" });
    if (!user) {
      user = await User.create({
        phone: "+00000000000",
        firstName: "Guest",
        lastName: "User",
        username: "guest",
        isGuest: true,
        status: "online",
      });
    } else {
      user.status = "online";
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        isGuest: user.isGuest,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/qr-login", async (req, res, next) => {
  try {
    let user = await User.findOne({ phone: "+77777777777" });
    if (!user) {
      user = await User.create({
        phone: "+77777777777",
        firstName: "Demo",
        lastName: "User",
        username: "demouser",
        isGuest: false,
        status: "online",
      });
    } else {
      user.status = "online";
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/clerk", async (req, res, next) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: "Clerk Secret Key is not configured on the server" });
      return;
    }

    const { createClerkClient, verifyToken } = await import("@clerk/backend");
    const clerkClient = createClerkClient({ secretKey });

    let userId: string;
    try {
      const decoded = await verifyToken(token, { secretKey });
      userId = decoded.sub;
    } catch (err: any) {
      res.status(401).json({ error: `Invalid Clerk token: ${err.message || err}` });
      return;
    }

    // Retrieve user details from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase() || "";
    const firstName = clerkUser.firstName || clerkUser.username || `User_${userId.slice(-6)}`;
    const lastName = clerkUser.lastName || "";
    const username = clerkUser.username || undefined;
    const avatarUrl = clerkUser.imageUrl || null;

    // Find user in MongoDB
    let user = await User.findOne({ clerkId: userId });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    let isNewUser = false;

    if (user) {
      // Update existing user with Clerk ID if not already linked
      let hasChanges = false;
      if (!user.clerkId) {
        user.clerkId = userId;
        hasChanges = true;
      }
      if (avatarUrl && (!user.avatar || !user.avatar.url)) {
        user.avatar = { url: avatarUrl, publicId: null };
        hasChanges = true;
      }
      if (hasChanges) {
        await user.save();
      }
    } else {
      // Create new user in local MongoDB
      isNewUser = true;
      user = await User.create({
        clerkId: userId,
        email: email || undefined,
        firstName,
        lastName,
        username,
        avatar: avatarUrl ? { url: avatarUrl, publicId: null } : undefined,
        status: "online",
      });
    }

    user.status = "online";
    await user.save();

    const { accessToken, refreshToken } = generateTokens({ userId: user._id.toString() });

    res.json({
      success: true,
      isNewUser,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        bio: user.bio || "",
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
