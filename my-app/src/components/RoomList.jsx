import { useMemo, useState, useEffect, useRef } from 'react'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'

const RoomList = () => {
  const {
    rooms,
    activeRoomId,
    setActiveRoomId,
    createRoom,
    createGroupRoom,
    updateRoomName,
    searchAllMessages,
    searchUsers,
    searchResults,
    setSearchTarget,
    userSearchResults,
    userSearchLoading,
    inviteMembers,
  } = useChat()
  const { profile } = useAuth()

  const [userSearch, setUserSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debouncedRef = useRef(null)
  const [error, setError] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const globalDebouncedRef = useRef(null)
  const globalInputRef = useRef(null)

  const ownName = profile?.username || 'me'

  const addUserToGroup = (uid) => {
    setSelectedUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]))
  }

  const removeUserFromGroup = (uid) => {
    setSelectedUsers((prev) => prev.filter((item) => item !== uid))
  }

  const createGroup = async () => {
    setError('')
    try {
      const defaultName = selectedUsers
        .map((uid) => {
          const match = userSearchResults.find((item) => item.uid === uid)
          return match?.username || match?.email || uid
        })
        .filter(Boolean)
        .join(', ')
      await createGroupRoom({ name: defaultName || 'Group Chat', memberIds: selectedUsers })
      setUserSearch('')
      setSelectedUsers([])
    } catch (err) {
      setError(err.message || 'Failed to create group chat.')
    }
  }

  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current)
    debouncedRef.current = setTimeout(() => setDebouncedQuery(userSearch), 280)
    return () => clearTimeout(debouncedRef.current)
  }, [userSearch])

  useEffect(() => {
    if (globalDebouncedRef.current) clearTimeout(globalDebouncedRef.current)
    globalDebouncedRef.current = setTimeout(() => searchAllMessages(globalQuery), 280)
    return () => clearTimeout(globalDebouncedRef.current)
  }, [globalQuery, searchAllMessages])

  useEffect(() => {
    if (debouncedQuery && debouncedQuery.trim()) searchUsers(debouncedQuery)
  }, [debouncedQuery])

  const renameRoom = async (room) => {
    const current = room.name || ''
    const next = window.prompt('Enter new chatroom name:', current)
    if (!next || next.trim() === current) return

    setError('')
    try {
      await updateRoomName({ roomId: room.id, name: next })
    } catch (err) {
      setError(err.message || 'Failed to rename room.')
    }
  }

  const bufferLabels = useMemo(
    () =>
      selectedUsers.map((uid) => {
        const match = userSearchResults.find((item) => item.uid === uid)
        return match?.username || match?.email || uid
      }),
    [selectedUsers, userSearchResults],
  )

  return (
    <aside className="sidebar">
      <h2>Rooms</h2>

      <div className="stack">
        <div className="stack">
          <label style={{ display: 'block', marginBottom: 6 }}>Global message search</label>
          <input
            ref={globalInputRef}
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                globalInputRef.current?.focus()
              }
            }}
            placeholder="Search all messages"
            aria-label="Search all messages"
          />

          {searchResults.length > 0 && (
            <div className="stack">
              {searchResults.slice(0, 12).map((item) => (
                <button
                  key={`${item.roomId}-${item.id}`}
                  type="button"
                  className="room-btn"
                  onClick={() => {
                    setActiveRoomId(item.roomId)
                    setSearchTarget({ roomId: item.roomId, messageId: item.id })
                  }}
                >
                  <span>{item.text || 'Media message'}</span>
                  <small>{item.senderName || item.senderEmail}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="user-search-area">
          <label style={{ display: 'block', marginBottom: 6 }}>Find people</label>
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search users by username/email"
            aria-label="Find users"
          />
          {userSearchLoading && <small> Searching users…</small>}

          {userSearchResults.length > 0 && (
            <div className="user-search-overlay">
              <ul className="room-list">
                {userSearchResults.map((item) => (
                  <li key={item.uid} className="user-search-row">
                    <div className="user-search-info">
                      <strong>{item.username || item.email || item.uid}</strong>
                      <div className="user-search-sub">{item.email || item.uid}</div>
                    </div>
                    <div className="user-search-actions">
                      <button
                        type="button"
                        className="btn btn-alt"
                        onClick={async () => {
                          try {
                            await createRoom({ memberIds: [item.uid], name: `${ownName} + ${item.uid}` })
                            setUserSearch('')
                          } catch (err) {
                            console.warn(err)
                          }
                        }}
                      >
                        DM
                      </button>
                      <button type="button" className="btn" onClick={() => addUserToGroup(item.uid)}>
                        Add
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="stack">
            <small>Group buffer: {bufferLabels.join(', ')}</small>
            <div className="row-wrap">
              {selectedUsers.map((uid) => (
                <button key={uid} type="button" className="action-btn" onClick={() => removeUserFromGroup(uid)}>
                  Remove {uid}
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="btn" onClick={createGroup}>
          Create group chat
        </button>
        {error && <small className="error-text">{error}</small>}
      </div>

      <ul className="room-list">
        {rooms.map((room) => (
          <li key={room.id} className="room-row">
            <button className={`room-btn ${room.id === activeRoomId ? 'active' : ''}`} onClick={() => setActiveRoomId(room.id)} type="button">
              <span>{room.name}</span>
              <small>{room.isPrivate ? 'Private' : 'Group'}</small>
            </button>
            <button className="action-btn" onClick={() => renameRoom(room)} type="button">
              Rename
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default RoomList
