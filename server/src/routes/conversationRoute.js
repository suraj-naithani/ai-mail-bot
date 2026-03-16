import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.js";
import {
    createConversation,
    deleteConversation,
    getChats,
    getConversation,
    listConversations,
    sendMessage,
    updateConversationTitle,
} from "../controller/conversationController.js";

const router = Router();

router.post("/", isAuthenticated, createConversation);
router.get("/", isAuthenticated, listConversations);
router.get("/:id", isAuthenticated, getConversation);
router.patch("/:id", isAuthenticated, updateConversationTitle);
router.delete("/:id", isAuthenticated, deleteConversation);
router.get("/:id/chats", isAuthenticated, getChats);
router.post("/:id/chats", isAuthenticated, sendMessage);

export default router;
