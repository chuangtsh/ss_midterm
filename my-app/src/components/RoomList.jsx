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
    userSearchResults,
    userSearchLoading,
    inviteMembers,
  } = useChat()
  const { profile } = useAuth()

  const [newRoomUser, setNewRoomUser] = useState('')
  const [groupName, setGroupName] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [addTargetUid, setAddTargetUid] = useState('')
  const debouncedRef = useRef(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const ownName = profile?.username || 'me'
  const existingGroups = rooms.filter((r) => !r.isPrivate && r.members.includes(profile?.uid))

  const createPrivate = async () => {
    setError('')
    const uid = newRoomUser.trim()
    if (!uid) return
    try {
      await createRoom({ memberIds: [uid], name: `${ownName} + ${uid}` })
      setNewRoomUser('')
    } catch (err) {
      setError(err.message || 'Failed to create room.')
    }
  }

  const addUserToGroup = (uid) => {
    setSelectedUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]))
  }

  const removeUserFromGroup = (uid) => {
    setSelectedUsers((prev) => prev.filter((item) => item !== uid))
  }

  const createGroup = async () => {
    setError('')
    try {
      await createGroupRoom({ name: groupName, memberIds: selectedUsers })
      setGroupName('')
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
    if (debouncedQuery && debouncedQuery.trim()) searchUsers(debouncedQuery)
  }, [debouncedQuery])

  const handleAddToExisting = async (roomId, uid) => {
    try {
      await inviteMembers({ roomId, memberIds: [uid] })
      setAddTargetUid('')
    } catch (err) {
      console.warn(err)
    }
  }

  const handleCreateGroupWithUser = async (uid) => {
    try {
      const name = window.prompt('Group name (optional)', `Group with ${uid}`) || `Group with ${uid}`
      await createGroupRoom({ name, memberIds: [uid] })
      setAddTargetUid('')
    } catch (err) {
      console.warn(err)
    }
  }

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
        {error && <small className="error-text">{error}</small>}
      </div>

      <div className="stack">
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Group name"
        />

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Find people</label>
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search users by username/email"
            aria-label="Find users"
          />
          {userSearchLoading && <small> Searching users…</small>}

          {userSearchResults.length > 0 && (
            <ul className="room-list" style={{ marginTop: 8 }}>
              {userSearchResults.map((item) => (
                <li key={item.uid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.username || item.email || item.uid}</strong>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{item.email || item.uid}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
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
                    <button type="button" className="btn" onClick={() => setAddTargetUid(item.uid)}>
                      Add
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedUsers.length > 0 && (
            <div className="stack">
              <small>Selected users: {selectedUsers.join(', ')}</small>
              <div className="row-wrap">
                {selectedUsers.map((uid) => (
                  <button key={uid} type="button" className="action-btn" onClick={() => removeUserFromGroup(uid)}>
                    Remove {uid}
                  </button>
                ))}
              </div>
            </div>
          )}

          {addTargetUid && (
            <div style={{ marginTop: 8, borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: 8 }}>
              <small>
                Choose a group to add <strong>{addTargetUid}</strong> into:
              </small>
              {existingGroups.length === 0 && (
                <div style={{ marginTop: 6 }}>No existing groups. You can create a new group.</div>
              )}
              {existingGroups.length > 0 && (
                <ul className="room-list" style={{ marginTop: 6 }}>
                  {existingGroups.map((g) => (
                    <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{g.name}</strong>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{g.members.length} members</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-alt" onClick={() => handleAddToExisting(g.id, addTargetUid)}>
                          Add to group
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => handleCreateGroupWithUser(addTargetUid)}>
                  Create new group with {addTargetUid}
                </button>
                <button type="button" className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => setAddTargetUid('')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="button" className="btn" onClick={createGroup}>
          Create group chat
        </button>
      </div>

      <div className="stack">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Global message search" />
        <button type="button" className="btn btn-alt" onClick={() => searchAllMessages(search)}>
          Search all messages
        </button>
        {summary && <small>{summary}</small>}
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
