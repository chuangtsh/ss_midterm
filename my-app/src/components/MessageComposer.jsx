import { useState } from 'react'
import { askBot } from '../services/chatbot'

const MessageComposer = ({
  onSend,
  onOpenSticker,
  onCancelReply,
  replyTo,
  disabled,
}) => {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [gifTerm, setGifTerm] = useState('')
  const [gifResults, setGifResults] = useState([])

  const submit = async (event) => {
    event.preventDefault()
    await onSend({ text, imageFile })
    setText('')
    setImageFile(null)
  }

  const fetchGifs = async () => {
    const key = import.meta.env.VITE_TENOR_API_KEY
    if (!key || !gifTerm) return

    const response = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(gifTerm)}&key=${key}&limit=8&media_filter=gif`,
    )
    const json = await response.json()
    setGifResults(json.results || [])
  }

  const sendGif = async (gif) => {
    const url = gif?.media_formats?.gif?.url
    if (!url) return
    await onSend({ gifUrl: url })
    setGifResults([])
    setGifTerm('')
  }

  const sendBotMessage = async () => {
    if (!text.trim()) return
    const answer = await askBot(text)
    await onSend({ text: `🤖 ${answer}` })
    setText('')
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
        <input
          placeholder="Type a message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImageFile(event.target.files?.[0] || null)}
          disabled={disabled}
        />

        <button className="btn" type="submit" disabled={disabled}>
          Send
        </button>
        <button className="btn btn-alt" type="button" onClick={onOpenSticker} disabled={disabled}>
          Draw
        </button>
        <button className="btn btn-ghost" type="button" onClick={sendBotMessage} disabled={disabled}>
          Ask Bot
        </button>
      </form>

      <div className="gif-bar">
        <input
          value={gifTerm}
          onChange={(event) => setGifTerm(event.target.value)}
          placeholder="Search GIFs"
          disabled={disabled}
        />
        <button className="btn btn-alt" type="button" onClick={fetchGifs} disabled={disabled}>
          Find GIF
        </button>
      </div>

      {!!gifResults.length && (
        <div className="gif-grid">
          {gifResults.map((gif) => (
            <button key={gif.id} className="gif-item" type="button" onClick={() => sendGif(gif)}>
              <img src={gif.media_formats?.tinygif?.url} alt={gif.content_description || 'gif'} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default MessageComposer
