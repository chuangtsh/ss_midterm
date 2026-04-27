import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const ProfileModal = ({ open, onClose }) => {
  const { user, profile, saveProfile, uploadProfilePhoto } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', phone: '', address: '', photoURL: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile || !open) return

    setForm({
      username: profile.username || '',
      email: user?.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      photoURL: profile.photoURL || '',
    })
    setPhotoFile(null)
    setError('')
  }, [profile, user, open])

  if (!open) return null

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      let nextPhotoURL = form.photoURL
      if (photoFile) {
        nextPhotoURL = await uploadProfilePhoto(photoFile)
      }

      await saveProfile({ ...form, photoURL: nextPhotoURL })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.form
        className="modal-card"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>My Profile</h2>

        <div className="profile-photo-block">
          <img src={form.photoURL || '/vite.svg'} alt="profile" className="profile-photo-preview" />
          <label>
            Upload Photo
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <label>
          Profile Picture URL
          <input value={form.photoURL} onChange={(event) => updateField('photoURL', event.target.value)} />
        </label>

        <label>
          Username
          <input value={form.username} onChange={(event) => updateField('username', event.target.value)} required />
        </label>

        <label>
          Email (auth-managed)
          <input value={form.email} disabled />
        </label>

        <label>
          Phone Number
          <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
        </label>

        <label>
          Address
          <textarea value={form.address} onChange={(event) => updateField('address', event.target.value)} rows={3} />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}

export default ProfileModal
