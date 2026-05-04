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

  const getUserLabel = (userItem, fallbackUid) => {
    if (!userItem && fallbackUid) {
      const match = userSearchResults.find((item) => item.uid === fallbackUid)
      return match?.username || match?.email || fallbackUid
    }
    return userItem?.username || userItem?.email || userItem?.uid || fallbackUid || ''
  }

  const addUserToGroup = (userItem) => {
    if (!userItem?.uid) return
    setSelectedUsers((prev) => (prev.some((item) => item.uid === userItem.uid) ? prev : [...prev, userItem]))
  }

  const removeUserFromGroup = (uid) => {
    setSelectedUsers((prev) => prev.filter((item) => item.uid !== uid))
  }

  const createGroup = async () => {
    setError('')
    try {
      const defaultName = selectedUsers.map((item) => getUserLabel(item)).filter(Boolean).join(', ')
      await createGroupRoom({ name: defaultName || 'Group Chat', memberIds: selectedUsers.map((item) => item.uid) })
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
    searchUsers(debouncedQuery)
  }, [debouncedQuery, searchUsers])

  useEffect(() => {
    if (userSearch.trim()) return
    if (debouncedRef.current) clearTimeout(debouncedRef.current)
    setDebouncedQuery('')
    searchUsers('')
  }, [userSearch, searchUsers])

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

  const bufferLabels = useMemo(() => selectedUsers.map((item) => getUserLabel(item)), [selectedUsers])

  const trimmedUserSearch = userSearch.trim()
  const trimmedDebounced = debouncedQuery.trim()
  const userSearchPending = trimmedUserSearch.length > 0 && trimmedDebounced !== trimmedUserSearch
  const showUserOverlay = trimmedUserSearch.length > 0

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
          {showUserOverlay && (
            <div className="user-search-overlay">
              {!userSearchLoading && !userSearchPending && userSearchResults.length === 0 && (
                <div className="user-search-status">No users found.</div>
              )}
              {userSearchResults.length > 0 && (
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
                              const label = item.username || item.email || item.uid
                              await createRoom({ memberIds: [item.uid], name: `${ownName} + ${label}` })
                              setUserSearch('')
                            } catch (err) {
                              console.warn(err)
                            }
                          }}
                        >
                          DM
                        </button>
                        <button type="button" className="btn" onClick={() => addUserToGroup(item)}>
                          Add
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="stack">
            <small>Group buffer: {bufferLabels.join(', ')}</small>
            <div className="row-wrap">
              {selectedUsers.map((item) => (
                <button key={item.uid} type="button" className="action-btn" onClick={() => removeUserFromGroup(item.uid)}>
                  Remove {getUserLabel(item, item.uid)}
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
              <small>{room.isBot ? 'AI Bot' : room.isPrivate ? 'Private' : 'Group'}</small>
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
