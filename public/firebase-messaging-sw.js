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
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Task Reminder';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a pending task.',
    icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    tag: 'task-reminder',
    renotify: true,
    requireInteraction: true,
    data: {
      url: self.location.origin
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
