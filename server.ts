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

let dbAdmin: any;
let firestoreStatus = "initializing";
let firestoreError = "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin safely
try {
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        const cert = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(cert),
          projectId: firebaseConfig.projectId,
        });
        console.log(`Firebase Admin initialized using Service Account Key for project: ${firebaseConfig.projectId}`);
      } catch (e: any) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY secret. Falling back to default credentials.");
        admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
    } else {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
    }
  }
  const adminApp = admin.apps[0];
  dbAdmin = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

  // Run connection test in background
  (async () => {
    try {
      await dbAdmin.collection('_connection_test_').doc('test').get();
      firestoreStatus = "connected";

      // Ensure 'tasks' collection is visible by creating a placeholder if empty
      const tasksRef = dbAdmin.collection('tasks');
      const snapshot = await tasksRef.limit(1).get();
      if (snapshot.empty) {
        await tasksRef.doc('welcome_placeholder').set({
          title: "Welcome to UniPlanner! 🚀",
          description: "This is a placeholder task to make the 'tasks' collection visible in your console.",
          deadline: new Date(Date.now() + 86400000).toISOString(),
          category: "System",
          completed: false,
          userId: "system_placeholder",
          createdAt: new Date().toISOString(),
          remindersSent: []
        });
      }
    } catch (e: any) {
      console.warn(`Primary DB connection failed: ${e.message}`);
      try {
        const fallbackDb = getFirestore(adminApp, '(default)');
        await fallbackDb.collection('_connection_test_').doc('test').get();
        dbAdmin = fallbackDb;
        firestoreStatus = "connected (fallback)";
      } catch (e2: any) {
        firestoreStatus = "failed";
        firestoreError = e2.message;
      }
    }
  })();
} catch (err: any) {
  console.error("Firebase Admin initialization failed:", err.message);
  firestoreStatus = "error";
  firestoreError = err.message;
}

// Email Transporter (Lazy initialization)
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    
    if (!user || !pass) {
      const missing = [];
      if (!user) missing.push("SMTP_USER");
      if (!pass) missing.push("SMTP_PASS");
      throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

// --- Internal Helper Functions ---

const sendPushInternal = async (userId: string, title: string, body: string) => {
  if (!dbAdmin) return { status: "error", message: "Firestore not initialized" };
  
  const userDoc = await dbAdmin.collection('users').doc(userId).get();
  if (!userDoc.exists) return { status: "error", message: "User not found" };

  const userData = userDoc.data();
  const tokens = userData?.fcmTokens || [];
  if (tokens.length === 0) return { status: "skipped", message: "No tokens" };

  const message = {
    notification: { title, body },
    webpush: {
      notification: {
        title, body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        tag: 'task-reminder',
        renotify: true,
        requireInteraction: true,
      }
    },
    tokens: tokens.filter((t: any) => typeof t === 'string' && t.length > 0),
  };

  if (message.tokens.length === 0) return { status: "skipped", message: "No valid tokens" };
  return await admin.messaging().sendEachForMulticast(message);
};

const sendEmailInternal = async (to: string, subject: string, html: string) => {
  try {
    const mailTransporter = getTransporter();
    
    // Create a plain text version by stripping HTML tags (simple fallback)
    const safeHtml = html || '';
    const text = safeHtml.replace(/<[^>]*>?/gm, '');

    const info = await mailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: safeHtml,
    });
    
    console.log(`Email sent successfully: ${info.messageId}`);
    return { status: "ok", messageId: info.messageId };
  } catch (e: any) {
    console.error("Internal email failed:", e.message);
    return { status: "error", message: e.message };
  }
};

// --- Reminder Engine ---

const checkReminders = async () => {
  if (firestoreStatus !== "connected" && firestoreStatus !== "connected (fallback)") return;
  
  console.log("Reminder Engine: Checking for due tasks...");
  const now = new Date();
  
  try {
    const tasksSnapshot = await dbAdmin.collection('tasks').where('completed', '==', false).get();
    
    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      const deadline = new Date(task.deadline);
      const timeDiffMin = Math.floor((deadline.getTime() - now.getTime()) / 60000);
      const remindersSent = task.remindersSent || [];

      // 0. 1 Day Reminder (24 Hours)
      if (timeDiffMin <= 1440 && timeDiffMin > 1438 && !remindersSent.includes('1day')) {
        console.log(`Sending 1day reminder for task: ${task.title}`);
        
        // Send Push
        await sendPushInternal(task.userId, "Task Due in 24 Hours", `"${task.title}" is due in exactly 24 hours!`);
        
        // Send Email
        const userDoc = await dbAdmin.collection('users').doc(task.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.email && userData?.role !== 'faculty') {
            await sendEmailInternal(userData.email, `[UniPlanner] 1 Day Reminder: ${task.title}`, `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6366f1;">Task Due in 24 Hours</h2>
                <p>Your task <strong>${task.title}</strong> is due in exactly 24 hours.</p>
                <p>Deadline: ${new Date(task.deadline).toLocaleString()}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">This is an automated reminder from UniPlanner.</p>
              </div>
            `);
          }
        }

        // Mark as sent
        await taskDoc.ref.update({ remindersSent: admin.firestore.FieldValue.arrayUnion('1day') });
      }

      // 1. 15 Minute Reminder
      if (timeDiffMin <= 15 && timeDiffMin > 13 && !remindersSent.includes('15min')) {
        console.log(`Sending 15min reminder for task: ${task.title}`);
        
        // Send Push
        await sendPushInternal(task.userId, "Task Due Soon", `"${task.title}" is due in 15 minutes!`);
        
        // Send Email
        const userDoc = await dbAdmin.collection('users').doc(task.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.email && userData?.role !== 'faculty') {
            await sendEmailInternal(userData.email, `[UniPlanner] 15 Min Reminder: ${task.title}`, `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6366f1;">Task Due Soon</h2>
                <p>Your task <strong>${task.title}</strong> is due in 15 minutes.</p>
                <p>Deadline: ${new Date(task.deadline).toLocaleString()}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">This is an automated reminder from UniPlanner.</p>
              </div>
            `);
          }
        }

        // Mark as sent
        await taskDoc.ref.update({ remindersSent: admin.firestore.FieldValue.arrayUnion('15min') });
      }

      // 2. Deadline Reminder
      if (timeDiffMin <= 0 && timeDiffMin > -2 && !remindersSent.includes('deadline')) {
        console.log(`Sending deadline reminder for task: ${task.title}`);
        
        // Send Push
        await sendPushInternal(task.userId, "Task Deadline Reached", `"${task.title}" is due NOW!`);
        
        // Send Email
        const userDoc = await dbAdmin.collection('users').doc(task.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.email && userData?.role !== 'faculty') {
            await sendEmailInternal(userData.email, `[UniPlanner] Deadline Reached: ${task.title}`, `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #ef4444;">Deadline Reached</h2>
                <p>The deadline for <strong>${task.title}</strong> has been reached.</p>
                <p>Time: ${new Date(task.deadline).toLocaleString()}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">This is an automated reminder from UniPlanner.</p>
              </div>
            `);
          }
        }

        // Mark as sent
        await taskDoc.ref.update({ remindersSent: admin.firestore.FieldValue.arrayUnion('deadline') });
      }
    }
  } catch (err: any) {
    console.error("Reminder Engine Error:", err.message);
  }
};

// Run every minute
setInterval(checkReminders, 60000);

// Send Push Notification Route
app.post("/api/send-push", async (req, res) => {
  const { userId, title, body } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await sendPushInternal(userId, title, body);
    res.json(result);
  } catch (error: any) {
    console.error("Push API failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Send Email Route
app.post("/api/send-email", async (req, res) => {
  const { to, subject, html } = req.body;

  try {
    const result = await sendEmailInternal(to, subject, html);
    res.json(result);
  } catch (error: any) {
    console.error("Email API failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Trigger Reminders Route (For Cron Jobs)
app.get("/api/check-reminders", async (req, res) => {
  try {
    console.log("Cron Trigger: Running reminder check...");
    await checkReminders();
    res.json({ status: "ok", message: "Reminder check completed" });
  } catch (error: any) {
    console.error("Cron Trigger failed:", error.message);
    res.status(500).json({ error: error.message });
  }
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
    },
    env_check: {
      has_smtp_user: !!process.env.SMTP_USER,
      has_smtp_pass: !!process.env.SMTP_PASS,
      has_service_account: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      node_env: process.env.NODE_ENV
    }
  });
});

// Diagnostic endpoint for SMTP (Safe - doesn't show password)
app.get("/api/debug-smtp", (req, res) => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT || "587";

  res.json({
    configured: !!(user && pass),
    user: user ? `${user.substring(0, 3)}...${user.split('@')[1]}` : "MISSING",
    pass_length: pass ? pass.length : 0,
    host,
    port,
    secure: process.env.SMTP_SECURE === "true"
  });
});

async function startServer() {
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

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
