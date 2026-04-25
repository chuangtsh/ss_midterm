import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const ProfileModal = ({ open, onClose }) => {
  const { user, profile, saveProfile } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', phone: '', address: '', photoURL: '' })

  useEffect(() => {
    if (!profile || !open) return

    setForm({
      username: profile.username || '',
      email: user?.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      photoURL: profile.photoURL || '',
    })
  }, [profile, user, open])

  if (!open) return null

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    await saveProfile(form)
    onClose()
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

        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save
          </button>
        </div>
      </motion.form>
    </div>
  )
}

export default ProfileModal
