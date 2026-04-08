import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
}

// Initialize Firestore Admin with the specific database ID from config
// We use the admin.app() instance to ensure it's tied to the initialized app
const dbAdmin = getFirestore(admin.apps[0], firebaseConfig.firestoreDatabaseId);
console.log("Firestore Admin initialized for database:", firebaseConfig.firestoreDatabaseId);

let firestoreStatus = "testing";
let firestoreError = "";

// Startup Connection Test
async function testFirestoreConnection() {
  try {
    console.log("Testing Firestore Admin connection...");
    // Try to fetch a non-existent doc just to check permissions
    await dbAdmin.collection('_connection_test_').doc('test').get();
    firestoreStatus = "connected";
    console.log("Firestore Admin connection test successful (Permissions OK)");
  } catch (error: any) {
    firestoreStatus = "failed";
    firestoreError = error.message;
    console.error("Firestore Admin connection test FAILED:", error.message);
    if (error.message.includes("PERMISSION_DENIED")) {
      console.error("CRITICAL: Service account lacks permissions for database:", firebaseConfig.firestoreDatabaseId);
    }
  }
}
testFirestoreConnection();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      firestore: {
        status: firestoreStatus,
        error: firestoreError,
        databaseId: firebaseConfig.firestoreDatabaseId
      }
    });
  });

  // Send Push Notification Route
  app.post("/api/send-push", async (req, res) => {
    const { userId, title, body } = req.body;

    try {
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      console.log(`Attempting to send push to user: ${userId}`);
      const userDoc = await dbAdmin.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.warn(`User ${userId} not found in Firestore`);
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      console.log(`User data found. FCM tokens count: ${userData?.fcmTokens?.length || 0}`);
      const tokens = userData?.fcmTokens || [];

      if (tokens.length === 0) {
        return res.json({ status: "skipped", message: "No FCM tokens found for this user" });
      }

      const message = {
        notification: { 
          title, 
          body 
        },
        webpush: {
          notification: {
            title,
            body,
            icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png', // Student/Task icon
            badge: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
            vibrate: [200, 100, 200],
            tag: 'task-reminder',
            renotify: true,
            requireInteraction: true, // Keeps it visible until user interacts
            actions: [
              {
                action: 'open_app',
                title: 'Open Manager'
              }
            ]
          }
        },
        tokens: tokens.filter((t: any) => typeof t === 'string' && t.length > 0),
      };

      if (message.tokens.length === 0) {
        return res.json({ status: "skipped", message: "No valid FCM tokens found" });
      }

      const response = await admin.messaging().sendEachForMulticast(message);
      res.json({ 
        status: "ok", 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        stack: error.stack,
        ...(error.toJSON ? error.toJSON() : error)
      };
      console.error("Failed to send push notification. Full error:", JSON.stringify(errorDetails, null, 2));
      res.status(500).json({ 
        error: "Failed to send push notification", 
        details: error.message,
        code: error.code,
        fullError: errorDetails
      });
    }
  });

  // Send Email Route
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Email not sent.");
      return res.status(200).json({ status: "skipped", message: "SMTP not configured" });
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      let errorMessage = "Failed to send email";
      if (error.message.includes("535-5.7.8")) {
        errorMessage = "Email Login Failed: Please use a Google 'App Password' instead of your regular password. Go to myaccount.google.com/apppasswords to create one.";
      }
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
