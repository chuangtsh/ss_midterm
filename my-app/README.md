# Firebase Chatroom (React + Vite)

This project now includes a production-style chatroom scaffold with:

- Email/password + Google sign in
- Protected routes
- Private rooms and room membership
- Text/image/GIF/sticker messages
- Edit/unsend for own messages only
- Reply threading with scroll + highlight to original message
- Emoji reactions and reaction removal
- Profile modal with editable fields
- Message input sanitization
- Global message search
- Basic block user flow for direct messaging
- Notification API hook for unread alerts

## 1) Folder structure

src/
├─ components/
│  ├─ ChatWindow.jsx
│  ├─ MessageComposer.jsx
│  ├─ ProfileModal.jsx
│  ├─ ProtectedRoute.jsx
│  ├─ RoomList.jsx
│  └─ StickerCanvas.jsx
├─ context/
│  ├─ AuthContext.jsx
│  └─ ChatContext.jsx
├─ pages/
│  ├─ AuthPage.jsx
│  └─ ChatPage.jsx
├─ services/
│  └─ chatbot.js
├─ utils/
│  └─ sanitize.js
├─ App.css
├─ App.jsx
├─ index.css
└─ main.jsx

## 2) Install dependencies

```bash
npm install
```

Runtime packages used:

- firebase
- react-router-dom
- dompurify
- framer-motion

## 3) Firebase config integration

Firebase setup is loaded from [firebase_config.js](firebase_config.js).

If you need to update keys, edit only that file.

## 4) Environment variables

Create [.env.local](.env.local):

```bash
VITE_TENOR_API_KEY=your_tenor_key
VITE_BOT_PROVIDER=openai
VITE_OPENAI_API_KEY=your_openai_key
VITE_OPENAI_MODEL=gpt-4.1-mini
# OR
# VITE_BOT_PROVIDER=gemini
# VITE_GEMINI_API_KEY=your_gemini_key
```

For production, use Firebase Functions as a proxy for AI API keys.

## 5) Firestore data model

- users/{uid}
	- username, email, phone, address, photoURL, blockedUsers[]
- rooms/{roomId}
	- name, isPrivate, members[], createdBy, updatedAt
- rooms/{roomId}/messages/{messageId}
	- senderId, senderEmail, senderName, senderPhoto
	- text, searchTokens[]
	- imageUrl, gifUrl, sticker
	- replyToId, replyPreview
	- reactions: { emoji: [uid...] }
	- participants[]

## 6) Firestore security rules (starter)

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		function isAuthed() {
			return request.auth != null;
		}

		function isRoomMember(roomId) {
			return isAuthed() && request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.members;
		}

		match /users/{uid} {
			allow read: if isAuthed();
			allow write: if isAuthed() && request.auth.uid == uid;
		}

		match /rooms/{roomId} {
			allow create: if isAuthed();
			allow read: if isRoomMember(roomId);
			allow update: if isRoomMember(roomId);

			match /messages/{messageId} {
				allow read: if isRoomMember(roomId);
				allow create: if isRoomMember(roomId)
					&& request.resource.data.senderId == request.auth.uid;
				allow update, delete: if isRoomMember(roomId)
					&& resource.data.senderId == request.auth.uid;
			}
		}
	}
}
```

## 7) Firebase Hosting

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting
# Select: existing project, public directory = dist, SPA rewrite = yes
firebase deploy
```

## 8) Hook usage map

- `useState`: forms, active room, edit/reply mode, GIF results, modal open state
- `useEffect`: auth listener, room/message realtime listeners, notification permission, unread notifications
- `useContext`: global auth state (`AuthContext`) and chat state (`ChatContext`)

## 9) Notes for remaining hardening

- Move AI requests to Firebase Functions (secret-safe)
- Add Cloud Functions to enforce bidirectional block policy server-side
- Add composite indexes for room/message search queries when prompted by Firestore console
- Add optional service worker if you need true background push notifications
