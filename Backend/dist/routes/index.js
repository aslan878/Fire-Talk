"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messages_1 = __importDefault(require("./messages"));
const groups_1 = __importDefault(require("./groups"));
const channels_1 = __importDefault(require("./channels"));
const conversations_1 = __importDefault(require("./conversations"));
const chats_all_1 = __importDefault(require("./chats-all"));
const auth_1 = __importDefault(require("./auth"));
const users_1 = __importDefault(require("./users"));
const saved_1 = __importDefault(require("./saved"));
const settings_1 = __importDefault(require("./settings"));
const router = (0, express_1.Router)();
router.use("/auth", auth_1.default);
router.use("/users", users_1.default);
router.use("/saved", saved_1.default);
router.use("/settings", settings_1.default);
router.use("/messages", messages_1.default);
router.use("/groups", groups_1.default);
router.use("/channels", channels_1.default);
router.use("/conversations", conversations_1.default);
router.use("/chats", chats_all_1.default);
router.get("/health", (_req, res) => {
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=index.js.map