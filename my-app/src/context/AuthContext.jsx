import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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

  const fallbackProfileFromAuth = (firebaseUser) => ({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
    phone: '',
    address: '',
    photoURL: firebaseUser.photoURL || '',
    blockedUsers: [],
  })

  const ensureProfile = useCallback(async (firebaseUser, extra = {}) => {
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
  }, [])

  const safeEnsureProfile = useCallback(async (firebaseUser, extra = {}) => {
    const withTimeout = (promise, ms = 7000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Profile sync timeout')), ms),
        ),
      ])

    try {
      await withTimeout(ensureProfile(firebaseUser, extra))
    } catch (error) {
      // Keep auth usable even if Firestore rules/profile writes are misconfigured.
      console.warn('Profile sync failed:', error)
      setProfile(fallbackProfileFromAuth(firebaseUser))
    }
  }, [ensureProfile])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        safeEnsureProfile(firebaseUser)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [safeEnsureProfile])

  const signUp = async ({ email, password, username }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    if (username) {
      await updateProfile(result.user, { displayName: username })
    }
    safeEnsureProfile(result.user, { username })
  }

  const signIn = async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
    safeEnsureProfile(result.user)
  }

  const signInGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    safeEnsureProfile(result.user)
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
