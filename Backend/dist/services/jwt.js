"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokens = generateTokens;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default_access_secret_fire_talk_123456";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_refresh_secret_fire_talk_789012";
function generateTokens(payload) {
    const accessToken = jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
    const refreshToken = jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
}
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
    }
    catch (e) {
        return null;
    }
}
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
    }
    catch (e) {
        return null;
    }
}
//# sourceMappingURL=jwt.js.map