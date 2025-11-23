"use node";

import crypto from "node:crypto";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Encrypt API key using AES-256-GCM (Node.js action)
 */
export const encryptApiKey = internalAction({
    args: {
        apiKey: v.string(),
    },
    handler: async (_ctx, args) => {
        const algorithm = "aes-256-gcm";
        const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(args.apiKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const authTag = cipher.getAuthTag();
        
        // Return: iv:authTag:encrypted
        return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    },
});

/**
 * Decrypt API key using AES-256-GCM (Node.js action)
 */
export const decryptApiKey = internalAction({
    args: {
        encryptedData: v.string(),
    },
    handler: async (_ctx, args) => {
        const algorithm = "aes-256-gcm";
        const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
        
        const [ivHex, authTagHex, encrypted] = args.encryptedData.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    },
});

