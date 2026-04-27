import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: 'AIzaSyCv3HuN1Cdq9h2DX9EKZiHiqWVJfu1j5gc',
  authDomain: 'midterm-chatroom-6afb8.firebaseapp.com',
  databaseURL: 'https://midterm-chatroom-6afb8-default-rtdb.firebaseio.com',
  projectId: 'midterm-chatroom-6afb8',
  storageBucket: 'midterm-chatroom-6afb8.firebasestorage.app',
  messagingSenderId: '454096243690',
  appId: '1:454096243690:web:ac6ac96226613a8d608093',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const rtdb = getDatabase(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()