// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCv3HuN1Cdq9h2DX9EKZiHiqWVJfu1j5gc",
  authDomain: "midterm-chatroom-6afb8.firebaseapp.com",
  databaseURL: "https://midterm-chatroom-6afb8-default-rtdb.firebaseio.com",
  projectId: "midterm-chatroom-6afb8",
  storageBucket: "midterm-chatroom-6afb8.firebasestorage.app",
  messagingSenderId: "454096243690",
  appId: "1:454096243690:web:ac6ac96226613a8d608093"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);