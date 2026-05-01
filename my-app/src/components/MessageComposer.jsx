import { useCallback, useEffect, useRef, useState } from 'react'

const MessageComposer = ({
  onSend,
  onOpenSticker,
  onCancelReply,
  replyTo,
  error,
  disabled,
}) => {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [gifTerm, setGifTerm] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifOpen, setGifOpen] = useState(false)
  const [gifBusy, setGifBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const fileInputRef = useRef(null)

  const clearImage = () => {
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const runWithTimeout = async (promiseFactory, timeoutMs = 12000) => {
    return Promise.race([
      promiseFactory(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs),
      ),
    ])
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setLocalError('')
    try {
      await runWithTimeout(() => onSend({ text, imageFile }))
      setText('')
      clearImage()
    } catch (err) {
      setLocalError(err.message || 'Failed to send message.')
    } finally {
      setBusy(false)
    }
  }

  const fetchGifs = useCallback(async (term = gifTerm) => {
    const key = import.meta.env.VITE_GIPHY_API_KEY || 'XLH4a1r3MPnDris9011QGpicsRcn2TG7'
    const query = term.trim()
    if (!key || !query) {
      setGifResults([])
      return
    }

    setGifBusy(true)
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=18&rating=pg-13`,
      )
      const json = await response.json()
      setGifResults(json.data || [])
    } finally {
      setGifBusy(false)
    }
  }, [gifTerm])

  useEffect(() => {
    if (!gifOpen) return
    const timer = setTimeout(() => {
      fetchGifs(gifTerm)
    }, 240)

    return () => clearTimeout(timer)
  }, [gifTerm, gifOpen, fetchGifs])

  const sendGif = async (gif) => {
    const url = gif?.images?.original?.url
    if (!url) return
    setBusy(true)
    setLocalError('')
    try {
      await runWithTimeout(() => onSend({ gifUrl: url }))
      setGifResults([])
      setGifTerm('')
      setGifOpen(false)
    } catch (err) {
      setLocalError(err.message || 'Failed to send GIF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer-wrap">
      {replyTo && (
        <div className="reply-preview">
          Replying to <b>{replyTo.senderName}</b>: {replyTo.text || 'Media message'}
          <button type="button" className="link-btn" onClick={onCancelReply}>
            Cancel
          </button>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <div className="composer-bar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            disabled={disabled || busy}
            className="hidden-file"
            id="chat-image-input"
          />

          <label htmlFor="chat-image-input" className="tool-btn" title="Attach image">
            🖼
          </label>

          <button
            className={`tool-btn ${gifOpen ? 'active' : ''}`}
            type="button"
            onClick={() => setGifOpen((prev) => !prev)}
            disabled={disabled || busy}
            title="GIF"
          >
            GIF
          </button>

          <button className="tool-btn" type="button" onClick={onOpenSticker} disabled={disabled || busy} title="Draw sticker">
            ✏️
          </button>

          <input
            className="message-input-round"
            placeholder="Type a message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={disabled || busy}
          />

          <button className="send-btn" type="submit" disabled={disabled || busy}>
            {busy ? '…' : '➤'}
          </button>
        </div>

        {imageFile && (
          <div className="file-chip">
            <span>🖼 {imageFile.name}</span>
            <button className="action-btn" type="button" onClick={clearImage} disabled={disabled || busy}>
              Remove
            </button>
          </div>
        )}
      </form>

      {(localError || error) && <p className="error-text">{localError || error}</p>}

      {gifOpen && (
        <div className="gif-popover">
          <input
            value={gifTerm}
            onChange={(event) => setGifTerm(event.target.value)}
            placeholder="Search GIFs"
            disabled={disabled || busy}
            className="gif-search"
          />

          {gifBusy && <small>Searching…</small>}

          <div className="gif-grid">
            {gifResults.map((gif) => (
              <button key={gif.id} className="gif-item" type="button" onClick={() => sendGif(gif)}>
                <img src={gif?.images?.fixed_width_small?.url || gif?.images?.preview_gif?.url} alt={gif?.title || 'gif'} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageComposer
