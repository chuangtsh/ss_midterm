import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { get, off, onValue, ref as rtdbRef, set, update } from 'firebase/database'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, googleProvider, rtdb, storage } from '../../firebase_config'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileListenerRef = useRef(null)

  const fallbackProfileFromAuth = (firebaseUser) => ({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailLower: (firebaseUser.email || '').toLowerCase(),
    username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
    usernameLower: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user').toLowerCase(),
    phone: '',
    address: '',
    photoURL: firebaseUser.photoURL || '',
  })

  const ensureProfile = useCallback(async (firebaseUser, extra = {}) => {
    const profileRef = rtdbRef(rtdb, `users/${firebaseUser.uid}/profile`)
    const snapshot = await get(profileRef)

    if (!snapshot.exists()) {
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailLower: (firebaseUser.email || '').toLowerCase(),
        username: extra.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'new-user',
        usernameLower: (extra.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'new-user').toLowerCase(),
        phone: extra.phone || '',
        address: extra.address || '',
        photoURL: firebaseUser.photoURL || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await set(profileRef, newProfile)
      setProfile(newProfile)
      return
    }

    const current = snapshot.val() || {}
    const patch = {}
    if (!current.uid) patch.uid = firebaseUser.uid
    if (!current.email) patch.email = firebaseUser.email || ''
    if (!current.emailLower) patch.emailLower = (firebaseUser.email || '').toLowerCase()
    if (!current.username) {
      patch.username = extra.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'new-user'
    }
    if (!current.usernameLower) {
      patch.usernameLower = (patch.username || current.username || '').toLowerCase()
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = Date.now()
      await update(profileRef, patch)
    }

    setProfile({
      ...current,
      ...patch,
    })
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (profileListenerRef.current) {
        profileListenerRef.current()
        profileListenerRef.current = null
      }

      setUser(firebaseUser)

      if (firebaseUser) {
        try {
          await ensureProfile(firebaseUser)
        } catch (error) {
          console.warn('Profile bootstrap failed:', error)
          setProfile(fallbackProfileFromAuth(firebaseUser))
        }

        const profileRef = rtdbRef(rtdb, `users/${firebaseUser.uid}/profile`)
        const handle = (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val() || {}
            setProfile({
              ...fallbackProfileFromAuth(firebaseUser),
              ...data,
            })
            return
          }
          setProfile(fallbackProfileFromAuth(firebaseUser))
        }

        onValue(profileRef, handle)
        profileListenerRef.current = () => off(profileRef, 'value', handle)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      unsubscribe()
      if (profileListenerRef.current) {
        profileListenerRef.current()
        profileListenerRef.current = null
      }
    }
  }, [ensureProfile])

  const signUp = async ({ email, password, username }) => {
    const normalizedEmail = email.trim().toLowerCase()
    let result

    try {
      result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      if (username) {
        await updateProfile(result.user, { displayName: username })
      }
    } catch (error) {
      if (error?.code !== 'auth/email-already-in-use') {
        throw error
      }

      // Common recovery: auth user exists (possibly from a previous partial signup),
      // but profile was deleted from RTDB. If password matches, recover seamlessly.
      try {
        const existing = await signInWithEmailAndPassword(auth, normalizedEmail, password)
        if (username && !existing.user.displayName) {
          await updateProfile(existing.user, { displayName: username }).catch(() => {})
        }
        await ensureProfile(existing.user, { username })
        return
      } catch (signinError) {
        if (
          signinError?.code === 'auth/wrong-password'
          || signinError?.code === 'auth/invalid-credential'
        ) {
          throw new Error('This email is already registered. Sign in instead, or reset the password.')
        }
        throw signinError
      }
    }

    try {
      await ensureProfile(result.user, { username })
    } catch (error) {
      // Auth account is already created at this point; keep user signed in and continue.
      console.warn('Profile creation after signup failed, continuing with auth user:', error)
    }
  }

  const signIn = async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
    try {
      await ensureProfile(result.user)
    } catch (error) {
      console.warn('Profile sync after sign-in failed, continuing with auth user:', error)
    }
  }

  const signInGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    try {
      await ensureProfile(result.user)
    } catch (error) {
      console.warn('Profile sync after Google sign-in failed, continuing with auth user:', error)
    }
  }

  const logout = () => signOut(auth)

  const uploadProfilePhoto = async (file) => {
    if (!user || !file) return ''
    const extension = file.name?.split('.').pop() || 'jpg'
    const objectRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}.${extension}`)
    await uploadBytes(objectRef, file)
    return getDownloadURL(objectRef)
  }

  const saveProfile = async (payload) => {
    if (!user) return

    const nextProfile = {
      uid: user.uid,
      email: user.email,
      emailLower: (user.email || '').toLowerCase(),
      username: payload.username ?? profile?.username ?? '',
      usernameLower: (payload.username ?? profile?.username ?? '').toLowerCase(),
      phone: payload.phone ?? profile?.phone ?? '',
      address: payload.address ?? profile?.address ?? '',
      photoURL: payload.photoURL ?? profile?.photoURL ?? '',
      updatedAt: Date.now(),
    }

    // Optimistic local update for immediate UI response.
    setProfile((prev) => ({ ...prev, ...nextProfile }))

    await update(rtdbRef(rtdb, `users/${user.uid}/profile`), nextProfile)

    if (payload.username || payload.photoURL) {
      await updateProfile(user, {
        displayName: payload.username || user.displayName,
        photoURL: payload.photoURL || user.photoURL,
      })
    }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInGoogle,
    logout,
    saveProfile,
    uploadProfilePhoto,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
