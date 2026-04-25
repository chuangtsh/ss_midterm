import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const AuthPage = () => {
  const { signUp, signIn, signInGoogle } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (mode === 'signup') {
        await signUp({ email, password, username })
      } else {
        await signIn({ email, password })
      }
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const loginGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      await signInGoogle()
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <motion.form
        className="auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <h1>Chatroom Login</h1>
        <p className="subtitle">Private rooms, replies, GIFs, stickers, and reactions.</p>

        {mode === 'signup' && (
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
        )}

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Working...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <button className="btn btn-alt" disabled={busy} onClick={loginGoogle} type="button">
          Continue with Google
        </button>

        <button
          className="link-btn"
          onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
          type="button"
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </motion.form>
    </div>
  )
}

export default AuthPage
