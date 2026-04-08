importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyACEZ0QQVFg4ZukPMiTMTK86Q5VotJGJM8",
  authDomain: "ai-studio-applet-webapp-c5968.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-c5968",
  storageBucket: "ai-studio-applet-webapp-c5968.firebasestorage.app",
  messagingSenderId: "532544215026",
  appId: "1:532544215026:web:6a80bbd4b1c326c969fd6b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
