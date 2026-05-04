import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  endAt,
  equalTo,
  get,
  limitToFirst,
  limitToLast,
  off,
  onValue,
  orderByChild,
  push,
  query,
  ref as rtdbRef,
  remove,
  set,
  startAt,
  update,
} from 'firebase/database'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { rtdb, storage } from '../../firebase_config'
import { useAuth } from './AuthContext'
import { sanitizeText, tokenize } from '../utils/sanitize'
import { CHATBOT_PROFILE, CHATBOT_UID, generateChatbotReply } from '../services/chatbot'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
  const { user, profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [remoteMessages, setRemoteMessages] = useState([])
  const [pendingMessages, setPendingMessages] = useState([])
  const [memberProfiles, setMemberProfiles] = useState({})
  const [searchResults, setSearchResults] = useState([])
  const [userSearchResults, setUserSearchResults] = useState([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [chatError, setChatError] = useState({ roomId: '', message: '' })
  const [searchTarget, setSearchTarget] = useState(null)
  const [blockedUserIds, setBlockedUserIds] = useState([])
  const [blockedByUserIds, setBlockedByUserIds] = useState([])
  const [roomLatestMessages, setRoomLatestMessages] = useState({})

  const blockedUserSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds])
  const blockedByUserSet = useMemo(() => new Set(blockedByUserIds), [blockedByUserIds])

  const normalizeMembers = (members) => {
    if (Array.isArray(members)) return members
    if (!members || typeof members !== 'object') return []
    return Object.keys(members).filter((uid) => Boolean(members[uid]))
  }

  const normalizeReactions = (reactions) => {
    if (!reactions || typeof reactions !== 'object') return {}
    return Object.fromEntries(
      Object.entries(reactions).map(([emoji, value]) => {
        if (Array.isArray(value)) {
          return [emoji, value.filter(Boolean)]
        }
        if (!value || typeof value !== 'object') {
          return [emoji, []]
        }
        return [emoji, Object.keys(value).filter((uid) => Boolean(value[uid]))]
      }),
    )
  }

  const messages = useMemo(() => {
    const merged = [...remoteMessages]
    const seenClientIds = new Set(remoteMessages.map((message) => message.clientId).filter(Boolean))

    pendingMessages.forEach((message) => {
      if (!message.clientId || !seenClientIds.has(message.clientId)) {
        merged.push(message)
      }
    })

    return merged
      .filter((message) => {
        const senderId = message?.senderId
        if (!senderId) return true
        if (senderId === user?.uid) return true
        if (senderId === CHATBOT_UID) return true
        if (blockedUserSet.has(senderId)) return false
        if (blockedByUserSet.has(senderId)) return false
        return true
      })
      .sort((a, b) => {
      const aTime = a?.createdAtMs || 0
      const bTime = b?.createdAtMs || 0
      return aTime - bTime
    })
  }, [remoteMessages, pendingMessages, user, blockedUserSet, blockedByUserSet])

  const ensureChatbotProfile = useCallback(async () => {
    const profileRef = rtdbRef(rtdb, `users/${CHATBOT_UID}/profile`)
    const snapshot = await get(profileRef)
    if (!snapshot.exists()) {
      await set(profileRef, {
        ...CHATBOT_PROFILE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }, [])

  const ensureChatbotRoom = useCallback(async () => {
    if (!user) return
    const roomId = `bot_${user.uid}`
    const roomRef = rtdbRef(rtdb, `rooms/${roomId}`)
    const snapshot = await get(roomRef)
    if (snapshot.exists()) return

    await set(roomRef, {
      name: 'AI Assistant',
      identifier: roomId,
      isPrivate: true,
      isBot: true,
      members: {
        [user.uid]: true,
        [CHATBOT_UID]: true,
      },
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const greetingRef = push(rtdbRef(rtdb, `messages/${roomId}`))
    if (greetingRef.key) {
      await set(greetingRef, {
        clientId: `bot-${Date.now()}`,
        createdAtMs: Date.now(),
        roomId,
        participants: [user.uid, CHATBOT_UID],
        senderId: CHATBOT_UID,
        senderEmail: CHATBOT_PROFILE.email,
        senderName: CHATBOT_PROFILE.username,
        senderPhoto: CHATBOT_PROFILE.photoURL,
        text: 'Hi! I’m your AI assistant. Ask me anything, and I’ll reply here.',
        searchTokens: tokenize('Hi! I’m your AI assistant. Ask me anything, and I’ll reply here.'),
        imageUrl: '',
        imagePath: '',
        gifUrl: '',
        sticker: null,
        replyToId: '',
        replyPreview: null,
        reactions: {},
        updatedAt: Date.now(),
      })
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    ensureChatbotProfile().catch(() => {})
    ensureChatbotRoom().catch(() => {})
  }, [user, ensureChatbotProfile, ensureChatbotRoom])

  useEffect(() => {
    if (!user) {
      setRooms([])
      return
    }

    const roomsRef = rtdbRef(rtdb, 'rooms')

    const onRooms = (snapshot) => {
      const raw = snapshot.val() || {}
      const nextRooms = Object.entries(raw)
        .map(([id, value]) => ({
          id,
          ...value,
          members: normalizeMembers(value?.members),
        }))
        .filter((room) => room.members.includes(user.uid))
        .sort((a, b) => {
          const aTime = a?.updatedAt || 0
          const bTime = b?.updatedAt || 0
          return bTime - aTime
        })

      setRooms(nextRooms)

      if (nextRooms.length === 0) {
        setActiveRoomId(null)
        return
      }

      const savedRoomId = localStorage.getItem(`active-room:${user.uid}`)
      const hasSaved = savedRoomId && nextRooms.some((room) => room.id === savedRoomId)

      if ((!activeRoomId || !nextRooms.some((room) => room.id === activeRoomId)) && hasSaved) {
        setActiveRoomId(savedRoomId)
      } else if (!activeRoomId || !nextRooms.some((room) => room.id === activeRoomId)) {
        setActiveRoomId(nextRooms[0].id)
      }
    }

    const onRoomsError = (error) => {
      setChatError({ roomId: '', message: error.message || 'Failed to load rooms.' })
    }

    onValue(roomsRef, onRooms, onRoomsError)

    return () => off(roomsRef, 'value', onRooms)
  }, [user, activeRoomId])

  useEffect(() => {
    if (!user || rooms.length === 0) {
      setRoomLatestMessages({})
      return
    }

    const handlers = new Map()

    rooms.forEach((room) => {
      const roomId = room.id
      const latestRef = query(
        rtdbRef(rtdb, `messages/${roomId}`),
        orderByChild('createdAtMs'),
        limitToLast(1),
      )
      const handler = (snapshot) => {
        if (!snapshot.exists()) {
          setRoomLatestMessages((prev) => {
            if (!prev[roomId]) return prev
            const next = { ...prev }
            delete next[roomId]
            return next
          })
          return
        }
        const value = snapshot.val() || {}
        const [id, message] = Object.entries(value)[0] || []
        if (!id || !message) return
        setRoomLatestMessages((prev) => ({
          ...prev,
          [roomId]: { id, ...message },
        }))
      }
      handlers.set(roomId, handler)
      onValue(latestRef, handler, () => {})
    })

    return () => {
      handlers.forEach((handler, roomId) => {
        const latestRef = query(
          rtdbRef(rtdb, `messages/${roomId}`),
          orderByChild('createdAtMs'),
          limitToLast(1),
        )
        off(latestRef, 'value', handler)
      })
    }
  }, [rooms, user])

  useEffect(() => {
    if (!user || !activeRoomId) return
    localStorage.setItem(`active-room:${user.uid}`, activeRoomId)
  }, [user, activeRoomId])

  useEffect(() => {
    if (!activeRoomId || !user) {
      setRemoteMessages([])
      setPendingMessages([])
      setMemberProfiles({})
      return
    }

    const messagesRef = rtdbRef(rtdb, `messages/${activeRoomId}`)

    const onMessages = (snapshot) => {
      const raw = snapshot.val() || {}
      const next = Object.entries(raw)
        .map(([id, value]) => ({
          id,
          ...value,
          reactions: normalizeReactions(value?.reactions),
        }))
        .sort((a, b) => (a?.createdAtMs || 0) - (b?.createdAtMs || 0))

      setRemoteMessages(next)

      const syncedClientIds = new Set(next.map((message) => message.clientId).filter(Boolean))
      setPendingMessages((prev) => prev.filter((message) => !syncedClientIds.has(message.clientId)))
    }

    const onMessagesError = (error) => {
      setChatError({ roomId: activeRoomId, message: error.message || 'Failed to load messages.' })
    }

    onValue(messagesRef, onMessages, onMessagesError)

    return () => off(messagesRef, 'value', onMessages)
  }, [activeRoomId, user])

  useEffect(() => {
    if (!activeRoomId) return
    setChatError((prev) => (prev.roomId && prev.roomId !== activeRoomId ? { roomId: '', message: '' } : prev))
  }, [activeRoomId])

  useEffect(() => {
    if (!user || !activeRoomId) {
      setMemberProfiles({})
      return
    }

    const room = rooms.find((item) => item.id === activeRoomId)
    const members = room?.members || []
    if (members.length === 0) {
      setMemberProfiles({})
      return
    }

    const handlers = new Map()

    members.forEach((uid) => {
      const profileRef = rtdbRef(rtdb, `users/${uid}/profile`)
      const handler = (snapshot) => {
        const profileData = snapshot.val() || {}
        setMemberProfiles((prev) => ({
          ...prev,
          [uid]: profileData,
        }))
      }
      handlers.set(uid, handler)
      onValue(profileRef, handler, () => {})
    })

    return () => {
      handlers.forEach((handler, uid) => {
        off(rtdbRef(rtdb, `users/${uid}/profile`), 'value', handler)
      })
    }
  }, [activeRoomId, rooms, user])

  useEffect(() => {
    if (!user) {
      setBlockedUserIds([])
      return
    }

    const blockedRef = rtdbRef(rtdb, `users/${user.uid}/blocked`)
    const onBlocked = (snapshot) => {
      const value = snapshot.val() || {}
      setBlockedUserIds(Object.keys(value).filter((uid) => Boolean(value[uid])))
    }

    onValue(blockedRef, onBlocked)
    return () => off(blockedRef, 'value', onBlocked)
  }, [user])

  useEffect(() => {
    if (!user || !activeRoomId) {
      setBlockedByUserIds([])
      return
    }

    const room = rooms.find((item) => item.id === activeRoomId)
    const members = (room?.members || []).filter((uid) => uid && uid !== user.uid)
    if (members.length === 0) {
      setBlockedByUserIds([])
      return
    }

    const handlers = new Map()

    members.forEach((uid) => {
      const blockedRef = rtdbRef(rtdb, `users/${uid}/blocked/${user.uid}`)
      const handler = (snapshot) => {
        const isBlocked = Boolean(snapshot.exists() && snapshot.val())
        setBlockedByUserIds((prev) => {
          const next = new Set(prev)
          if (isBlocked) {
            next.add(uid)
          } else {
            next.delete(uid)
          }
          return Array.from(next)
        })
      }
      handlers.set(uid, handler)
      onValue(blockedRef, handler, () => {})
    })

    return () => {
      handlers.forEach((handler, uid) => {
        off(rtdbRef(rtdb, `users/${uid}/blocked/${user.uid}`), 'value', handler)
      })
    }
  }, [activeRoomId, rooms, user])


  const uploadFile = async (file) => {
    const objectRef = ref(storage, `uploads/${user.uid}/${Date.now()}-${file.name}`)
    await uploadBytes(objectRef, file)
    const url = await getDownloadURL(objectRef)
    return { url, path: objectRef.fullPath }
  }

  const resolveMemberUid = async (rawInput) => {
    const input = (rawInput || '').trim()
    if (!input) return ''
    const lower = input.toLowerCase()

    // 1) Direct UID
    const byUid = await get(rtdbRef(rtdb, `users/${input}/profile`)).catch(() => null)
    if (byUid?.exists()) return input

    // 2) Username
    const byUsername = await get(
      query(rtdbRef(rtdb, 'users'), orderByChild('profile/usernameLower'), equalTo(lower), limitToFirst(1)),
    ).catch(() => null)
    if (byUsername?.exists()) {
      const first = Object.keys(byUsername.val() || {})[0]
      if (first) return first
    }

    // 3) Email
    const byEmail = await get(
      query(rtdbRef(rtdb, 'users'), orderByChild('profile/emailLower'), equalTo(lower), limitToFirst(1)),
    ).catch(() => null)
    if (byEmail?.exists()) {
      const first = Object.keys(byEmail.val() || {})[0]
      if (first) return first
    }

    return ''
  }

  const createRoom = async ({ memberIds = [], name = '' }) => {
    if (!user) return
    const resolvedMemberIds = []
    for (const raw of memberIds) {
      const resolved = await resolveMemberUid(raw)
      if (resolved && resolved !== user.uid) {
        resolvedMemberIds.push(resolved)
      }
    }

    const members = [...new Set([user.uid, ...resolvedMemberIds])]

    if (members.length < 2) {
      throw new Error('User not found. Enter valid UID, username, or email.')
    }

    // Deterministic private room id so either side lands in the same chatroom.
    if (members.length === 2) {
      const sorted = [...members].sort()
      const roomId = `dm_${sorted[0]}__${sorted[1]}`
      const roomRef = rtdbRef(rtdb, `rooms/${roomId}`)
      const existing = await get(roomRef)
      const memberMap = Object.fromEntries(sorted.map((uid) => [uid, true]))
      const otherUid = sorted.find((uid) => uid !== user.uid)

      if (otherUid) {
        if (blockedUserSet.has(otherUid)) {
          throw new Error('You blocked this user. Unblock them to start a chat.')
        }
        const blockedBy = await get(rtdbRef(rtdb, `users/${otherUid}/blocked/${user.uid}`)).catch(() => null)
        if (blockedBy?.exists() && blockedBy.val()) {
          throw new Error('This user has blocked you. You cannot start a direct chat.')
        }
      }

      if (!existing.exists()) {
        await set(roomRef, {
          name: sanitizeText(name) || 'Private Room',
          identifier: roomId,
          isPrivate: true,
          members: memberMap,
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }

      setActiveRoomId(roomId)
      return roomId
    }

    const roomRef = push(rtdbRef(rtdb, 'rooms'))
    const roomId = roomRef.key
    if (!roomId) throw new Error('Failed to create room.')

    await set(roomRef, {
      name: sanitizeText(name) || (members.length > 2 ? 'Group Chat' : 'Private Room'),
      identifier: roomId,
      isPrivate: members.length === 2,
      members: Object.fromEntries(members.map((uid) => [uid, true])),
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    setActiveRoomId(roomId)
    return roomId
  }

  const createGroupRoom = async ({ memberIds = [], name = '' }) => {
    const unique = [...new Set(memberIds.map((item) => (item || '').trim()).filter(Boolean))]
    if (unique.length < 2) {
      throw new Error('Add at least 2 other users for a group chat.')
    }
    return createRoom({ memberIds: unique, name: sanitizeText(name) || 'Group Chat' })
  }

  const updateRoomIdentifier = async ({ roomId, identifier }) => {
    if (!user || !roomId) return

    const clean = sanitizeText(identifier)
    if (!clean) throw new Error('Room ID cannot be empty.')

    const roomRef = rtdbRef(rtdb, `rooms/${roomId}`)
    const snapshot = await get(roomRef)
    if (!snapshot.exists()) throw new Error('Room not found.')

    const room = snapshot.val() || {}
    const members = normalizeMembers(room.members)
    if (!members.includes(user.uid)) {
      throw new Error('Only room members can modify room ID.')
    }

    await update(roomRef, {
      identifier: clean,
      updatedAt: Date.now(),
    })
  }

  const updateRoomName = async ({ roomId, name }) => {
    if (!user || !roomId) return

    const clean = sanitizeText(name)
    if (!clean) throw new Error('Room name cannot be empty.')

    const roomRef = rtdbRef(rtdb, `rooms/${roomId}`)
    const snapshot = await get(roomRef)
    if (!snapshot.exists()) throw new Error('Room not found.')

    const room = snapshot.val() || {}
    const members = normalizeMembers(room.members)
    if (!members.includes(user.uid)) {
      throw new Error('Only room members can rename this room.')
    }

    await update(roomRef, {
      name: clean,
      updatedAt: Date.now(),
    })
  }

  const inviteMembers = async ({ roomId, memberIds }) => {
    const roomRef = rtdbRef(rtdb, `rooms/${roomId}`)
    const snapshot = await get(roomRef)
    if (!snapshot.exists()) throw new Error('Room not found.')

    const room = snapshot.val() || {}
    const currentMembers = normalizeMembers(room.members)
    const merged = [...new Set([...currentMembers, ...memberIds])]

    await update(roomRef, {
      members: Object.fromEntries(merged.map((uid) => [uid, true])),
      updatedAt: Date.now(),
    })
  }

  const sendMessage = async ({ roomId, text, imageFile, gifUrl, sticker, replyTo }) => {
    if (!user || !roomId) return
    setChatError({ roomId: '', message: '' })

    const room = rooms.find((item) => item.id === roomId)
    if (!room) {
      throw new Error('No active room selected.')
    }

    const cleanText = sanitizeText(text)
    const hasContent = cleanText || imageFile || gifUrl || sticker
    if (!hasContent) {
      throw new Error('Type a message or attach media before sending.')
    }

    if (room.isPrivate && !room.isBot) {
      const otherUid = room.members.find((uid) => uid !== user.uid)
      if (otherUid) {
        if (blockedUserSet.has(otherUid)) {
          throw new Error('You blocked this user. Unblock them to chat.')
        }
        if (blockedByUserSet.has(otherUid)) {
          throw new Error('You can no longer chat with this user.')
        }
      }
    }

    let image = null
    if (imageFile) {
      image = await uploadFile(imageFile)
    }

    const clientId =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const createdAtMs = Date.now()

    const payload = {
      clientId,
      createdAtMs,
      roomId,
      participants: room.members,
      senderId: user.uid,
      senderEmail: user.email,
      senderName: profile?.username || user.displayName || user.email,
      senderPhoto: profile?.photoURL || user.photoURL || '',
      text: cleanText,
      searchTokens: tokenize(cleanText),
      imageUrl: image?.url || '',
      imagePath: image?.path || '',
      gifUrl: gifUrl || '',
      sticker: sticker || null,
      replyToId: replyTo?.id || '',
      replyPreview: replyTo
        ? {
            senderName: replyTo.senderName,
            text: replyTo.text || (replyTo.imageUrl ? '📷 Image' : replyTo.gifUrl ? '🎞️ GIF' : '🎨 Sticker'),
          }
        : null,
      reactions: {},
      updatedAt: Date.now(),
    }

    setPendingMessages((prev) => [
      ...prev,
      {
        id: `pending-${clientId}`,
        ...payload,
      },
    ])

    try {
      const msgRef = push(rtdbRef(rtdb, `messages/${roomId}`))
      if (!msgRef.key) throw new Error('Failed to create message.')
      await set(msgRef, payload)
      update(rtdbRef(rtdb, `rooms/${roomId}`), { updatedAt: Date.now() }).catch(() => {})
      if (room.isBot) {
        triggerBotReply({ roomId, incoming: payload }).catch((error) => {
          setChatError({ roomId, message: error?.message || 'AI bot failed to respond.' })
        })
      }
    } catch (error) {
      const message = error?.message || 'Failed to send message.'
      setChatError({ roomId, message })
      setPendingMessages((prev) => prev.filter((item) => item.clientId !== clientId))
      throw error
    }
  }

  const triggerBotReply = async ({ roomId, incoming }) => {
    if (!roomId || !user) return
    if (incoming?.senderId === CHATBOT_UID) return

    const recent = [...messages, incoming]
      .filter((message) => message?.text)
      .slice(-12)
      .map((message) => ({
        role: message.senderId === CHATBOT_UID ? 'assistant' : 'user',
        content: message.text,
      }))

    if (recent.length === 0) return

    const reply = await generateChatbotReply({
      messages: recent,
      systemPrompt: 'You are a helpful, friendly AI assistant inside a realtime chat app.',
    })

    const cleanReply = sanitizeText(reply)
    if (!cleanReply) return

    const botPayload = {
      clientId: `bot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAtMs: Date.now(),
      roomId,
      participants: [user.uid, CHATBOT_UID],
      senderId: CHATBOT_UID,
      senderEmail: CHATBOT_PROFILE.email,
      senderName: CHATBOT_PROFILE.username,
      senderPhoto: CHATBOT_PROFILE.photoURL,
      text: cleanReply,
      searchTokens: tokenize(cleanReply),
      imageUrl: '',
      imagePath: '',
      gifUrl: '',
      sticker: null,
      replyToId: incoming?.id || '',
      replyPreview: incoming?.text
        ? { senderName: incoming.senderName || 'You', text: incoming.text }
        : null,
      reactions: {},
      updatedAt: Date.now(),
    }

    const msgRef = push(rtdbRef(rtdb, `messages/${roomId}`))
    if (!msgRef.key) return
    await set(msgRef, botPayload)
    update(rtdbRef(rtdb, `rooms/${roomId}`), { updatedAt: Date.now() }).catch(() => {})
  }

  const editMessage = async ({ roomId, messageId, text }) => {
    const messageRef = rtdbRef(rtdb, `messages/${roomId}/${messageId}`)
    const snap = await get(messageRef)
    if (!snap.exists()) return
    if (snap.val().senderId !== user.uid) throw new Error('You can edit only your own messages.')

    const cleanText = sanitizeText(text)
    await update(messageRef, {
      text: cleanText,
      searchTokens: tokenize(cleanText),
      updatedAt: Date.now(),
      editedAt: Date.now(),
    })
  }

  const unsendMessage = async ({ roomId, message }) => {
    const messageRef = rtdbRef(rtdb, `messages/${roomId}/${message.id}`)
    if (message.senderId !== user.uid) throw new Error('You can unsend only your own messages.')

    if (message.imagePath) {
      const objectRef = ref(storage, message.imagePath)
      await deleteObject(objectRef).catch(() => {})
    }

    await remove(messageRef)
  }

  const toggleReaction = async ({ roomId, message, emoji }) => {
    const messageRef = rtdbRef(rtdb, `messages/${roomId}/${message.id}`)
    const snapshot = await get(messageRef)
    if (!snapshot.exists()) return

    const value = snapshot.val() || {}
    const currentEmoji = value?.reactions?.[emoji] || {}
    const hasReacted = Boolean(currentEmoji?.[user.uid])

    await update(messageRef, {
      [`reactions/${emoji}/${user.uid}`]: hasReacted ? null : true,
      updatedAt: Date.now(),
    })
  }

  const searchAllMessages = async (term) => {
    if (!user) return

    const safe = sanitizeText(term).toLowerCase()
    if (!safe) {
      setSearchResults([])
      return
    }

    const roomIds = rooms.filter((room) => room.members.includes(user.uid)).map((room) => room.id)
    const snapshots = await Promise.all(roomIds.map((roomId) => get(rtdbRef(rtdb, `messages/${roomId}`))))

    const matches = []
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) return
      const roomId = roomIds[index]
      const entries = Object.entries(snapshot.val() || {})
      entries.forEach(([id, value]) => {
        const senderId = value?.senderId
        if (senderId && senderId !== CHATBOT_UID) {
          if (blockedUserSet.has(senderId) || blockedByUserSet.has(senderId)) return
        }
        const tokens = Array.isArray(value?.searchTokens) ? value.searchTokens : []
        const textMatch = typeof value?.text === 'string' && value.text.toLowerCase().includes(safe)
        if (tokens.includes(safe) || textMatch) {
          matches.push({ id, roomId, ...value, reactions: normalizeReactions(value?.reactions) })
        }
      })
    })

    setSearchResults(matches)
  }

  const searchUsers = async (term) => {
    if (!user) return

    const safe = sanitizeText(term).toLowerCase().trim()
    if (!safe) {
      setUserSearchResults([])
      return
    }

    setUserSearchLoading(true)
    try {
      const usersRef = rtdbRef(rtdb, 'users')

      const [byUsername, byEmail] = await Promise.all([
        get(
          query(
            usersRef,
            orderByChild('profile/usernameLower'),
            startAt(safe),
            endAt(`${safe}\uf8ff`),
            limitToFirst(20),
          ),
        ),
        get(
          query(
            usersRef,
            orderByChild('profile/emailLower'),
            startAt(safe),
            endAt(`${safe}\uf8ff`),
            limitToFirst(20),
          ),
        ),
      ])

      const merged = new Map()
      const collect = (snapshot) => {
        const value = snapshot.val() || {}
        Object.entries(value).forEach(([uid, item]) => {
          if (uid === user.uid) return
          const profileData = item?.profile || {}
          const username = profileData.username || ''
          const email = profileData.email || ''
          if (!username && !email) return
          merged.set(uid, {
            uid,
            username,
            email,
            photoURL: profileData.photoURL || '',
          })
        })
      }

      if (byUsername?.exists()) collect(byUsername)
      if (byEmail?.exists()) collect(byEmail)

      setUserSearchResults(Array.from(merged.values()))
    } finally {
      setUserSearchLoading(false)
    }
  }

  const blockUser = async (targetUid) => {
    if (!user || !targetUid || targetUid === user.uid) return
    await set(rtdbRef(rtdb, `users/${user.uid}/blocked/${targetUid}`), true)
  }

  const unblockUser = async (targetUid) => {
    if (!user || !targetUid || targetUid === user.uid) return
    await remove(rtdbRef(rtdb, `users/${user.uid}/blocked/${targetUid}`))
  }

  const getRoomBlockState = useCallback(
    (room) => {
      if (!room || !user) {
        return {
          otherUid: '',
          userBlockedOther: false,
          blockedByOther: false,
          canChat: true,
        }
      }

      if (!room.isPrivate) {
        return {
          otherUid: '',
          userBlockedOther: false,
          blockedByOther: false,
          canChat: true,
        }
      }

      const otherUid = (room.members || []).find((uid) => uid !== user.uid) || ''
      if (!otherUid || otherUid === CHATBOT_UID) {
        return {
          otherUid,
          userBlockedOther: false,
          blockedByOther: false,
          canChat: true,
        }
      }

      const userBlockedOther = blockedUserSet.has(otherUid)
      const blockedByOther = blockedByUserSet.has(otherUid)
      return {
        otherUid,
        userBlockedOther,
        blockedByOther,
        canChat: !(userBlockedOther || blockedByOther),
      }
    },
    [user, blockedUserSet, blockedByUserSet],
  )


  const value = {
    rooms,
    activeRoomId,
    setActiveRoomId,
    messages,
    memberProfiles,
    searchResults,
    searchTarget,
    setSearchTarget,
    userSearchResults,
    userSearchLoading,
    chatError,
    blockedUserIds,
    blockedByUserIds,
    roomLatestMessages,
    createRoom,
    createGroupRoom,
    updateRoomIdentifier,
    updateRoomName,
    inviteMembers,
    sendMessage,
    editMessage,
    unsendMessage,
    toggleReaction,
    searchAllMessages,
    searchUsers,
    blockUser,
    unblockUser,
    getRoomBlockState,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used inside ChatProvider')
  return context
}
