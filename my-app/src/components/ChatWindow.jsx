import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

const emojis = ['👍', '❤️', '😂', '😮', '🔥']

const ChatWindow = ({ room, onReply }) => {
  const { user, profile } = useAuth()
  const { messages, editMessage, unsendMessage, toggleReaction, blockUser } = useChat()
  const lastReactRef = useRef(0)
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState('')
  const [highlightId, setHighlightId] = useState('')
  const refs = useRef({})
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const canSend = useMemo(() => {
    if (!room?.isPrivate) return true
    const other = room.members.find((id) => id !== user?.uid)
    return !(profile?.blockedUsers || []).includes(other)
  }, [room, profile?.blockedUsers, user?.uid])

  const jumpToMessage = (messageId) => {
    const node = refs.current[messageId]
    if (!node) return
    setHighlightId(messageId)
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setHighlightId(''), 1300)
  }

  const startEdit = (message) => {
    setEditingId(message.id)
    setDraft(message.text || '')
  }

  const saveEdit = async (roomId, messageId) => {
    await editMessage({ roomId, messageId, text: draft })
    setEditingId('')
    setDraft('')
  }

  const otherMember = room?.members.find((id) => id !== user?.uid)

  return (
    <section className="chat-window">
      <header className="chat-header">
        <div>
          <h2>{room?.name || 'Choose a room'}</h2>
          {room && <small>{room.isPrivate ? 'Private chat' : 'Group chat'}</small>}
          {!canSend && <p className="warning">You blocked this user. Direct messages are disabled.</p>}
        </div>

        {room?.isPrivate && otherMember && (
          <button type="button" className="btn btn-ghost" onClick={() => blockUser(otherMember)}>
            Block user
          </button>
        )}
      </header>

      <div className="message-list">
        {messages.map((message) => {
          const own = message.senderId === user?.uid
          return (
            <motion.article
              key={message.id}
              className={`message ${own ? 'own' : ''} ${highlightId === message.id ? 'highlight' : ''}`}
              ref={(el) => {
                refs.current[message.id] = el
              }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-head">
                <img src={message.senderPhoto || '/vite.svg'} alt="avatar" />
                <span className="sender">{message.senderName || message.senderEmail}</span>
              </div>

              {message.replyPreview && (
                <button className="reply-chip" type="button" onClick={() => jumpToMessage(message.replyToId)}>
                  ↩ {message.replyPreview.senderName}: {message.replyPreview.text}
                </button>
              )}

              {editingId === message.id ? (
                <div className="edit-row">
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} />
                  <button className="btn" type="button" onClick={() => saveEdit(room.id, message.id)}>
                    Save
                  </button>
                </div>
              ) : (
                message.text && <p>{message.text}</p>
              )}

              {message.imageUrl && <img className="msg-image" src={message.imageUrl} alt="attachment" />}
              {message.gifUrl && <img className="msg-image" src={message.gifUrl} alt="gif" />}
              {message.sticker && <img className="msg-image" src={message.sticker} alt="sticker" />}

              <div className="reaction-row">
                {emojis.map((emoji) => {
                  const count = message.reactions?.[emoji]?.length || 0
                  const handleToggle = (event) => {
                    const now = Date.now()
                    if (now - lastReactRef.current < 300) return
                    lastReactRef.current = now
                    toggleReaction({ roomId: room.id, message, emoji })
                  }

                  return (
                    <button
                      key={emoji}
                      className={`reaction-pill ${count > 0 ? 'active' : ''}`}
                      type="button"
                      onClick={handleToggle}
                      onPointerUp={handleToggle}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <em>{count}</em>}
                    </button>
                  )
                })}
              </div>

              <div className="message-actions">
                <button className="action-btn" type="button" onClick={() => onReply(message)}>
                  Reply
                </button>
                {own && (
                  <>
                    <button className="action-btn" type="button" onClick={() => startEdit(message)}>
                      Edit
                    </button>
                    <button className="action-btn danger" type="button" onClick={() => unsendMessage({ roomId: room.id, message })}>
                      Unsend
                    </button>
                  </>
                )}
              </div>
            </motion.article>
          )
        })}
        <div ref={endRef} />
      </div>
    </section>
  )
}

export default ChatWindow
