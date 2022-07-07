// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/4.8.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/4.8.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    'messagingSenderId': '103953800507'
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Handle incoming messages. Called when:
// - a message is received while the app has focus
// - the user clicks on an app notification created by a service worker
//   `messaging.setBackgroundMessageHandler` handler.
// messaging.onMessage(function (payload) {
//     console.log('Message received. ', payload);
//     // ...
// });
messaging.setBackgroundMessageHandler(function (payload) {
    // Customize notification here
    var notificationTitle = payload.data.title;
    var notificationOptions = {
        body: payload.data.body,
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        },
        tag: payload.data.click_action
    };
    self.addEventListener('notificationclick', function (event) {
        event.notification.close();
        event.waitUntil(
            clients.matchAll({
                type: "window"
            })
                .then(function (clientList) {
                    for (var i = 0; i < clientList.length; i++) {
                        var client = clientList[i];
                        if (client.url == '/' && 'focus' in client)
                            return client.focus();
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    });
    payload.data.image ? notificationOptions['icon'] = payload.data.image : null
    return self.registration.showNotification(notificationTitle,
        notificationOptions);
});
