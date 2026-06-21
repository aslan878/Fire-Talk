"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = requireUser;
const mongoose_1 = __importDefault(require("mongoose"));
function requireUser(req, res, next) {
    const id = req.header("x-user-id")?.trim();
    if (!id || !mongoose_1.default.isValidObjectId(id)) {
        res.status(401).json({ error: "X-User-Id header with a valid ObjectId is required" });
        return;
    }
    req.userId = id;
    next();
}
//# sourceMappingURL=requireUser.js.map