// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyBjgyASzKxiOX-Lk-1f-ppad983GpAk6AE",
  authDomain: "absensi-perkuliahan.firebaseapp.com",
  projectId: "absensi-perkuliahan",
  storageBucket: "absensi-perkuliahan.appspot.com",
  messagingSenderId: "370507083773",
  appId: "1:370507083773:web:ddece366d8bdda9f943394",
  measurementId: "G-86T4ZV2LSD"
};

// Pastikan hanya diinisialisasi sekali
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.db = firebase.firestore();
window.auth = firebase.auth();
