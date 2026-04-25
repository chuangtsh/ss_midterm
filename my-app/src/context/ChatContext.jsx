import { createContext, useContext, useEffect, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { db, storage } from '../../firebase_config'
import { useAuth } from './AuthContext'
import { sanitizeText, tokenize } from '../utils/sanitize'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
  const { user, profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [searchResults, setSearchResults] = useState([])

  useEffect(() => {
    if (!user) {
      setRooms([])
      return
    }

    const roomsQuery = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
    )

    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      const nextRooms = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setRooms(nextRooms)
      if (!activeRoomId && nextRooms.length) {
        setActiveRoomId(nextRooms[0].id)
      }
    })

    return unsubscribe
  }, [user, activeRoomId])

  useEffect(() => {
    if (!activeRoomId || !user) {
      setMessages([])
      return
    }

    const messagesQuery = query(
      collection(db, 'rooms', activeRoomId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))

      const myBlocked = new Set(profile?.blockedUsers || [])
      const filtered = next.filter((m) => !myBlocked.has(m.senderId))
      setMessages(filtered)
    })

    return unsubscribe
  }, [activeRoomId, user, profile?.blockedUsers])

  const uploadFile = async (file) => {
    const objectRef = ref(storage, `uploads/${user.uid}/${Date.now()}-${file.name}`)
    await uploadBytes(objectRef, file)
    const url = await getDownloadURL(objectRef)
    return { url, path: objectRef.fullPath }
  }

  const createRoom = async ({ memberIds = [], name = '' }) => {
    if (!user) return
    const members = [...new Set([user.uid, ...memberIds])]

    const docRef = await addDoc(collection(db, 'rooms'), {
      name: sanitizeText(name) || 'Private Room',
      isPrivate: members.length === 2,
      members,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setActiveRoomId(docRef.id)
    return docRef.id
  }

  const inviteMembers = async ({ roomId, memberIds }) => {
    const roomRef = doc(db, 'rooms', roomId)
    await updateDoc(roomRef, {
      members: arrayUnion(...memberIds),
      updatedAt: serverTimestamp(),
    })
  }

  const checkDirectMessageBlocked = async (room) => {
    if (!room?.isPrivate || room.members.length !== 2) return false

    const otherId = room.members.find((id) => id !== user.uid)
    const otherProfile = await getDoc(doc(db, 'users', otherId))
    const blockedUsers = otherProfile.data()?.blockedUsers || []
    return blockedUsers.includes(user.uid)
  }

  const sendMessage = async ({ roomId, text, imageFile, gifUrl, sticker, replyTo }) => {
    if (!user || !roomId) return

    const room = rooms.find((item) => item.id === roomId)
    if (!room) return

    const blocked = await checkDirectMessageBlocked(room)
    if (blocked) {
      throw new Error('This user blocked you. You can no longer send direct messages.')
    }

    let image = null
    if (imageFile) {
      image = await uploadFile(imageFile)
    }

    const cleanText = sanitizeText(text)

    const payload = {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await addDoc(collection(db, 'rooms', roomId, 'messages'), payload)
    await updateDoc(doc(db, 'rooms', roomId), { updatedAt: serverTimestamp() })
  }

  const editMessage = async ({ roomId, messageId, text }) => {
    const messageRef = doc(db, 'rooms', roomId, 'messages', messageId)
    const snap = await getDoc(messageRef)
    if (!snap.exists()) return
    if (snap.data().senderId !== user.uid) throw new Error('You can edit only your own messages.')

    const cleanText = sanitizeText(text)
    await updateDoc(messageRef, {
      text: cleanText,
      searchTokens: tokenize(cleanText),
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    })
  }

  const unsendMessage = async ({ roomId, message }) => {
    const messageRef = doc(db, 'rooms', roomId, 'messages', message.id)
    if (message.senderId !== user.uid) throw new Error('You can unsend only your own messages.')

    if (message.imagePath) {
      const objectRef = ref(storage, message.imagePath)
      await deleteObject(objectRef).catch(() => {})
    }

    await deleteDoc(messageRef)
  }

  const toggleReaction = async ({ roomId, message, emoji }) => {
    const messageRef = doc(db, 'rooms', roomId, 'messages', message.id)
    const users = message.reactions?.[emoji] || []
    const hasReacted = users.includes(user.uid)

    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    })
  }

  const searchAllMessages = async (term) => {
    if (!user) return

    const safe = sanitizeText(term).toLowerCase()
    if (!safe) {
      setSearchResults([])
      return
    }

    const messageQuery = query(
      collectionGroup(db, 'messages'),
      where('participants', 'array-contains', user.uid),
      where('searchTokens', 'array-contains', safe),
    )

    const snapshot = await getDocs(messageQuery)
    setSearchResults(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }

  const blockUser = async (otherUid) => {
    if (!user || !otherUid || otherUid === user.uid) return
    const me = doc(db, 'users', user.uid)
    await updateDoc(me, {
      blockedUsers: arrayUnion(otherUid),
      updatedAt: serverTimestamp(),
    })
  }

  const unblockUser = async (otherUid) => {
    if (!user || !otherUid) return
    const me = doc(db, 'users', user.uid)
    await updateDoc(me, {
      blockedUsers: arrayRemove(otherUid),
      updatedAt: serverTimestamp(),
    })
  }

  const sendSticker = async ({ roomId, sticker, replyTo }) => {
    await sendMessage({ roomId, sticker, replyTo })
  }

  const value = {
    rooms,
    activeRoomId,
    setActiveRoomId,
    messages,
    searchResults,
    createRoom,
    inviteMembers,
    sendMessage,
    sendSticker,
    editMessage,
    unsendMessage,
    toggleReaction,
    searchAllMessages,
    blockUser,
    unblockUser,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used inside ChatProvider')
  return context
}
