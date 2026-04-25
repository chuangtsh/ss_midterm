import { useMemo, useState } from 'react'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'

const RoomList = () => {
  const { rooms, activeRoomId, setActiveRoomId, createRoom, searchAllMessages, searchResults } = useChat()
  const { profile } = useAuth()
  const [newRoomUser, setNewRoomUser] = useState('')
  const [search, setSearch] = useState('')

  const ownName = profile?.username || 'me'

  const createPrivate = async () => {
    const uid = newRoomUser.trim()
    if (!uid) return
    await createRoom({ memberIds: [uid], name: `${ownName} + ${uid}` })
    setNewRoomUser('')
  }

  const summary = useMemo(() => {
    if (!search) return null
    return `${searchResults.length} messages matched.`
  }, [searchResults.length, search])

  return (
    <aside className="sidebar">
      <h2>Rooms</h2>

      <div className="stack">
        <input
          value={newRoomUser}
          onChange={(event) => setNewRoomUser(event.target.value)}
          placeholder="Invite UID for private room"
        />
        <button type="button" className="btn" onClick={createPrivate}>
          Create private room
        </button>
      </div>

      <div className="stack">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Global message search"
        />
        <button type="button" className="btn btn-alt" onClick={() => searchAllMessages(search)}>
          Search all messages
        </button>
        {summary && <small>{summary}</small>}
      </div>

      <ul className="room-list">
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              className={`room-btn ${room.id === activeRoomId ? 'active' : ''}`}
              onClick={() => setActiveRoomId(room.id)}
              type="button"
            >
              <span>{room.name}</span>
              <small>{room.isPrivate ? 'Private' : 'Group'}</small>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default RoomList
