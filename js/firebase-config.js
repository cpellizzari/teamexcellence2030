// Firebase Configuration for TE2030 Website
// Replace the placeholder values below with your actual Firebase config.
// To get these values:
// 1. Go to https://console.firebase.google.com
// 2. Create or select your project (te2030-website)
// 3. Go to Project Settings > Your apps > Web app
// 4. Copy the firebaseConfig object values here

const firebaseConfig = {
  apiKey: "AIzaSyDssBiyHGzXkE0HtzCkUdZkg-onFnE7d90",
  authDomain: "te2030-website.firebaseapp.com",
  projectId: "te2030-website",
  storageBucket: "te2030-website.firebasestorage.app",
  messagingSenderId: "161083857233",
  appId: "1:161083857233:web:800ed07b035fe80a1b5b70"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
