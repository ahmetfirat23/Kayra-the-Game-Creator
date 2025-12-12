"use node";

import crypto from "node:crypto";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Encrypt API key using AES-256-GCM
 */
export const encryptApiKey = internalAction({
    args: {
        apiKey: v.string(),
    },
    handler: async (_ctx, args) => {
        const algorithm = "aes-256-gcm";
        
        // Validate encryption key exists and is properly formatted
        if (!process.env.ENCRYPTION_KEY) {
            console.log("Missing ENCRYPTION_KEY env var");
            throw new Error("API key couldn't be saved");
        }
        if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
            console.log("Invalid ENCRYPTION_KEY format");
            throw new Error("API key couldn't be saved");
        }
        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
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
        
        // Validate encryption key exists and is properly formatted
        if (!process.env.ENCRYPTION_KEY) {
            console.log("Missing ENCRYPTION_KEY env var");
            throw new Error("Failed to retrieve API key");
        }
        if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
            console.log("Invalid ENCRYPTION_KEY format");
            throw new Error("Failed to retrieve API key");
        }

        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
        
        // Validate encrypted data format
        const parts = args.encryptedData.split(":");
        if (parts.length !== 3) {
            console.log("Invalid encrypted data format");
            throw new Error("Failed to retrieve API key");
        }
        const [ivHex, authTagHex, encrypted] = parts;
        
        // Validate hex strings
        if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(authTagHex) || !/^[0-9a-fA-F]+$/.test(encrypted)) {
            console.log("Invalid hex format in encrypted data");
            throw new Error("Failed to retrieve API key");
        }
        
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    },
});

