import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import RoomList from '../components/RoomList'
import ChatWindow from '../components/ChatWindow'
import MessageComposer from '../components/MessageComposer'
import ProfileModal from '../components/ProfileModal'

const ChatPage = () => {
  const { user, logout } = useAuth()
  const {
    rooms,
    activeRoomId,
    sendMessage,
    chatError,
    getRoomBlockState,
    roomLatestMessages,
  } = useChat()

  const [profileOpen, setProfileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const lastNotifiedId = useRef(new Map())

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
    if (!user) return
    if (notificationPermission !== 'granted') return

    const roomNameById = Object.fromEntries(rooms.map((item) => [item.id, item.name]))
    const isVisible = document.visibilityState === 'visible'

    Object.entries(roomLatestMessages).forEach(([roomId, latest]) => {
      if (!latest || latest.senderId === user.uid) return
      if (isVisible && roomId === activeRoomId) return

      const key = `${roomId}:${latest.id}`
      if (lastNotifiedId.current.get(roomId) === key) return

      lastNotifiedId.current.set(roomId, key)
      new Notification(`New message in ${roomNameById[roomId] || 'a room'}`, {
        body: latest.text ? latest.text.slice(0, 120) : 'Open chat to read new updates.',
      })
    })
  }, [rooms, user, roomLatestMessages, activeRoomId, notificationPermission])

  return (
    <div className={`chat-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <RoomList
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <main className="chat-main">
        <div className="top-row">
          <div className="row-wrap">
            {sidebarCollapsed && (
              <button
                className="action-btn"
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                ☰
              </button>
            )}
            <h1>Realtime Chatroom</h1>
          </div>
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
