"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const user_1 = __importDefault(require("../models/user"));
const redis_1 = __importDefault(require("../services/redis"));
const jwt_1 = require("../services/jwt");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
router.post("/register", async (req, res, next) => {
    try {
        const { phone, email, firstName, lastName, username } = req.body;
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
            user = await user_1.default.findOne({ email: trimmedEmail });
        }
        else if (trimmedPhone) {
            user = await user_1.default.findOne({ phone: trimmedPhone });
        }
        if (user) {
            if (trimmedUsername && trimmedUsername !== user.username) {
                const existingUsername = await user_1.default.findOne({ username: trimmedUsername });
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
        }
        else {
            if (trimmedPhone) {
                const existingPhone = await user_1.default.findOne({ phone: trimmedPhone });
                if (existingPhone) {
                    res.status(400).json({ error: "This phone number is already registered" });
                    return;
                }
            }
            if (trimmedEmail) {
                const existingEmail = await user_1.default.findOne({ email: trimmedEmail });
                if (existingEmail) {
                    res.status(400).json({ error: "This email is already registered" });
                    return;
                }
            }
            if (trimmedUsername) {
                const existingUsername = await user_1.default.findOne({ username: trimmedUsername });
                if (existingUsername) {
                    res.status(400).json({ error: "This username is already taken" });
                    return;
                }
            }
            user = await user_1.default.create({
                phone: trimmedPhone || undefined,
                email: trimmedEmail || undefined,
                firstName: trimmedFirstName,
                lastName: trimmedLastName,
                username: trimmedUsername || undefined,
                status: "online",
            });
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
        next(err);
    }
});
router.post("/login", async (req, res, next) => {
    try {
        const { phoneOrUsername } = req.body;
        if (!phoneOrUsername || typeof phoneOrUsername !== "string" || !phoneOrUsername.trim()) {
            res.status(400).json({ error: "Please enter your phone number, email, or username" });
            return;
        }
        const term = phoneOrUsername.trim();
        const user = await user_1.default.findOne({
            $or: [{ phone: term }, { email: term.toLowerCase() }, { username: term }],
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        user.status = "online";
        await user.save();
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
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
        const { email } = req.body;
        if (!email || typeof email !== "string" || !email.trim()) {
            res.status(400).json({ error: "Email is required" });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const otpCode = crypto_1.default.randomInt(100000, 999999).toString();
        const otpData = {
            code: otpCode,
            attempts: 3,
        };
        await redis_1.default.setEx(`otp:email:${cleanEmail}`, 300, JSON.stringify(otpData));
        await (0, email_1.sendOtpEmail)(cleanEmail, otpCode);
        console.log("\n==============================================");
        console.log(`[EMAIL SENDER] OTP Code for ${cleanEmail} is: \x1b[36m${otpCode}\x1b[0m`);
        console.log("==============================================\n");
        res.json({ success: true, message: "Verification code sent" });
    }
    catch (err) {
        next(err);
    }
});
router.post("/email/verify", async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ error: "Email and verification code are required" });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const cacheKey = `otp:email:${cleanEmail}`;
        const cachedData = await redis_1.default.get(cacheKey);
        if (!cachedData) {
            res.status(400).json({ error: "Code has expired or was not sent. Please request a new code." });
            return;
        }
        const otpData = JSON.parse(cachedData);
        if (otpData.attempts <= 0) {
            res.status(400).json({ error: "Maximum attempts exceeded. Please request a new code." });
            return;
        }
        if (otpData.code !== code) {
            otpData.attempts -= 1;
            if (otpData.attempts <= 0) {
                await redis_1.default.del(cacheKey);
                res.status(400).json({ error: "Invalid code. Attempts exhausted." });
            }
            else {
                const remainingTtl = await redis_1.default.ttl(cacheKey);
                await redis_1.default.setEx(cacheKey, remainingTtl > 0 ? remainingTtl : 300, JSON.stringify(otpData));
                res.status(400).json({ error: `Invalid code. Attempts remaining: ${otpData.attempts}` });
            }
            return;
        }
        await redis_1.default.del(cacheKey);
        let user = await user_1.default.findOne({ email: cleanEmail });
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await user_1.default.create({
                email: cleanEmail,
                firstName: `User_${cleanEmail.split("@")[0]}`,
                lastName: "",
                status: "online",
            });
        }
        else {
            user.status = "online";
            await user.save();
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
        next(err);
    }
});
router.get("/qr/generate", async (req, res, next) => {
    try {
        const qrToken = crypto_1.default.randomBytes(32).toString("hex");
        const qrSession = {
            status: "pending",
            userId: null,
        };
        await redis_1.default.setEx(`qr:${qrToken}`, 600, JSON.stringify(qrSession));
        res.json({ token: qrToken });
    }
    catch (err) {
        next(err);
    }
});
router.get("/qr/status/:token", async (req, res, next) => {
    try {
        const { token } = req.params;
        const cacheKey = `qr:${token}`;
        const sessionData = await redis_1.default.get(cacheKey);
        if (!sessionData) {
            res.status(404).json({ error: "QR session not found or expired." });
            return;
        }
        const session = JSON.parse(sessionData);
        if (session.status === "confirmed" && session.userId) {
            const user = await user_1.default.findById(session.userId);
            if (!user) {
                res.status(404).json({ error: "User not found." });
                return;
            }
            const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
            await redis_1.default.del(cacheKey);
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
    }
    catch (err) {
        next(err);
    }
});
router.post("/qr/confirm", async (req, res, next) => {
    try {
        const { token, userId: bodyUserId } = req.body;
        if (!token) {
            res.status(400).json({ error: "QR Token is required" });
            return;
        }
        const cacheKey = `qr:${token}`;
        const sessionData = await redis_1.default.get(cacheKey);
        if (!sessionData) {
            res.status(400).json({ error: "QR session not found or expired." });
            return;
        }
        const session = JSON.parse(sessionData);
        if (session.status !== "pending") {
            res.status(400).json({ error: "This QR code has already been confirmed or used." });
            return;
        }
        let finalUserId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const jwtToken = authHeader.split(" ")[1];
            const decoded = (0, jwt_1.verifyAccessToken)(jwtToken);
            if (decoded) {
                finalUserId = decoded.userId;
            }
        }
        if (!finalUserId && bodyUserId) {
            finalUserId = bodyUserId;
        }
        if (!finalUserId) {
            let demoUser = await user_1.default.findOne({ phone: "+77777777777" });
            if (!demoUser) {
                demoUser = await user_1.default.create({
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
        const user = await user_1.default.findById(finalUserId);
        if (!user) {
            res.status(404).json({ error: "User for confirmation not found in database." });
            return;
        }
        session.status = "confirmed";
        session.userId = user._id.toString();
        await redis_1.default.setEx(cacheKey, 60, JSON.stringify(session));
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
        next(err);
    }
});
router.post("/guest", async (req, res, next) => {
    try {
        let user = await user_1.default.findOne({ phone: "+00000000000" });
        if (!user) {
            user = await user_1.default.create({
                phone: "+00000000000",
                firstName: "Guest",
                lastName: "User",
                username: "guest",
                isGuest: true,
                status: "online",
            });
        }
        else {
            user.status = "online";
            await user.save();
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
        next(err);
    }
});
router.post("/qr-login", async (req, res, next) => {
    try {
        let user = await user_1.default.findOne({ phone: "+77777777777" });
        if (!user) {
            user = await user_1.default.create({
                phone: "+77777777777",
                firstName: "Demo",
                lastName: "User",
                username: "demouser",
                isGuest: false,
                status: "online",
            });
        }
        else {
            user.status = "online";
            await user.save();
        }
        const { accessToken, refreshToken } = (0, jwt_1.generateTokens)({ userId: user._id.toString() });
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
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
