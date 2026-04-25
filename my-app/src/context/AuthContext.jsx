import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../../firebase_config'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = async (firebaseUser, extra = {}) => {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username: extra.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'new-user',
        phone: extra.phone || '',
        address: extra.address || '',
        photoURL: firebaseUser.photoURL || '',
        blockedUsers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(userRef, newProfile)
      setProfile(newProfile)
      return
    }

    setProfile(snapshot.data())
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await ensureProfile(firebaseUser)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signUp = async ({ email, password, username }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (username) {
      await updateProfile(result.user, { displayName: username })
    }
    await ensureProfile(result.user, { username })
  }

  const signIn = async ({ email, password }) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await ensureProfile(result.user)
  }

  const signInGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    await ensureProfile(result.user)
  }

  const logout = () => signOut(auth)

  const saveProfile = async (payload) => {
    if (!user) return

    const userRef = doc(db, 'users', user.uid)
    const nextProfile = {
      username: payload.username ?? profile?.username ?? '',
      phone: payload.phone ?? profile?.phone ?? '',
      address: payload.address ?? profile?.address ?? '',
      photoURL: payload.photoURL ?? profile?.photoURL ?? '',
      updatedAt: serverTimestamp(),
    }

    await updateDoc(userRef, nextProfile)

    if (payload.username || payload.photoURL) {
      await updateProfile(user, {
        displayName: payload.username || user.displayName,
        photoURL: payload.photoURL || user.photoURL,
      })
    }

    const latest = await getDoc(userRef)
    setProfile(latest.data())
  }

  const value = { user, profile, loading, signUp, signIn, signInGoogle, logout, saveProfile }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
