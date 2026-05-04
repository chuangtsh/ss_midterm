import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import RoomList from '../components/RoomList'
import ChatWindow from '../components/ChatWindow'
import MessageComposer from '../components/MessageComposer'
import ProfileModal from '../components/ProfileModal'

const ChatPage = () => {
  const { user, logout } = useAuth()
  const { rooms, activeRoomId, sendMessage, chatError, messages, getRoomBlockState } = useChat()

  const [profileOpen, setProfileOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const lastNotifiedId = useRef('')

  const room = useMemo(() => rooms.find((item) => item.id === activeRoomId), [rooms, activeRoomId])
  const roomError = useMemo(
    () => (chatError?.roomId === activeRoomId ? chatError.message : ''),
    [chatError, activeRoomId],
  )
  const blockState = useMemo(() => getRoomBlockState(room), [getRoomBlockState, room])
  const disabledReason = useMemo(() => {
    if (!room || !room.isPrivate) return ''
    if (blockState.blockedByOther) return 'You can no longer chat in this DM.'
    if (blockState.userBlockedOther) return 'You blocked this user. Unblock to chat.'
    return ''
  }, [room, blockState])

  const requestNotifications = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  const send = async ({ text, imageFile, gifUrl }) => {
    if (!activeRoomId) return
    await sendMessage({ roomId: activeRoomId, text, imageFile, gifUrl, replyTo })
    setReplyTo(null)
  }

  useEffect(() => {
    if (!room || !user) return
    if (document.visibilityState === 'visible') return
    if (notificationPermission !== 'granted') return
    if (!messages.length) return

    const latest = messages[messages.length - 1]
    if (!latest || latest.senderId === user.uid) return
    if (latest.id && latest.id === lastNotifiedId.current) return

    lastNotifiedId.current = latest.id || ''
    new Notification(`New message in ${room.name}`, {
      body: latest.text ? latest.text.slice(0, 120) : 'Open chat to read new updates.',
    })
  }, [room, user, messages, notificationPermission])

  return (
    <div className="chat-layout">
      <RoomList />

      <main className="chat-main">
        <div className="top-row">
          <h1>Realtime Chatroom</h1>
          <div className="row-wrap">
            {'Notification' in window && notificationPermission !== 'granted' && (
              <button className="btn btn-ghost" type="button" onClick={requestNotifications}>
                Enable notifications
              </button>
            )}
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
              onCancelReply={() => setReplyTo(null)}
              replyTo={replyTo}
              error={roomError}
              disabled={Boolean(disabledReason)}
              disabledReason={disabledReason}
            />
          </>
        ) : (
          <div className="center-screen">Create or select a room to start chatting.</div>
        )}
      </main>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}

export default ChatPage
