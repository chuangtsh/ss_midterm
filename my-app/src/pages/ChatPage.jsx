import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import RoomList from '../components/RoomList'
import ChatWindow from '../components/ChatWindow'
import MessageComposer from '../components/MessageComposer'
import ProfileModal from '../components/ProfileModal'
import StickerCanvas from '../components/StickerCanvas'

const ChatPage = () => {
  const { user, logout } = useAuth()
  const { rooms, activeRoomId, sendMessage, sendSticker } = useChat()

  const [profileOpen, setProfileOpen] = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const lastMessageCount = useRef(0)

  const room = useMemo(() => rooms.find((item) => item.id === activeRoomId), [rooms, activeRoomId])

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const send = async ({ text, imageFile, gifUrl }) => {
    if (!activeRoomId) return
    await sendMessage({ roomId: activeRoomId, text, imageFile, gifUrl, replyTo })
    setReplyTo(null)
  }

  useEffect(() => {
    if (!room) return
    const unread = (room.unreadBy || {})[user.uid] || 0
    if (unread > lastMessageCount.current && Notification.permission === 'granted') {
      new Notification(`Unread messages in ${room.name}`, {
        body: 'Open chat to read new updates.',
      })
    }
    lastMessageCount.current = unread
  }, [room, user?.uid])

  return (
    <div className="chat-layout">
      <RoomList />

      <main className="chat-main">
        <div className="top-row">
          <h1>Realtime Chatroom</h1>
          <div className="row-wrap">
            <button className="btn btn-alt" type="button" onClick={() => setProfileOpen(true)}>
              Profile
            </button>
            <button className="btn btn-ghost" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>

        {room ? (
          <>
            <ChatWindow room={room} onReply={setReplyTo} />
            <MessageComposer
              onSend={send}
              onOpenSticker={() => setStickerOpen(true)}
              onCancelReply={() => setReplyTo(null)}
              replyTo={replyTo}
            />
          </>
        ) : (
          <div className="center-screen">Create or select a room to start chatting.</div>
        )}
      </main>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <StickerCanvas
        open={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onSend={(sticker) => {
          if (!activeRoomId) return
          sendSticker({ roomId: activeRoomId, sticker, replyTo })
          setReplyTo(null)
        }}
      />
    </div>
  )
}

export default ChatPage
