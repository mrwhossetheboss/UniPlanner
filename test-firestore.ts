
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

async function test() {
  try {
    let app;
    if (!admin.apps.length) {
      // Initialize without options to use environment defaults
      app = admin.initializeApp();
    } else {
      app = admin.app();
    }
    
    // Try to get the project ID from the initialized app
    console.log("Initialized with Project ID:", app.options.projectId || "Environment Default");
    
    // Try with default database first
    const db = getFirestore(app);
    
    console.log("Attempting to list collections on (default) database...");
    const collections = await db.listCollections();
    console.log("Collections found:", collections.map(c => c.id));
    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

test();
