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
```

## 5) Realtime Database data model

- users/{uid}/profile
	- username, usernameLower, email, emailLower, phone, address, photoURL
- rooms/{roomId}
	- name, isPrivate, members: { uid: true }, createdBy, createdAt, updatedAt
- messages/{roomId}/{messageId}
	- senderId, senderEmail, senderName, senderPhoto
	- text, searchTokens[]
	- imageUrl, gifUrl, sticker
	- replyToId, replyPreview
	- reactions: { emoji: { uid: true } }
	- participants[]

## 6) Realtime Database security rules (starter)

```txt
{
	"rules": {
		"users": {
			".read": "auth != null",
			".indexOn": ["profile/usernameLower", "profile/emailLower"],
			"$uid": {
				"profile": {
					".read": "auth != null",
					".write": "auth != null && auth.uid === $uid"
				}
			}
		},
		"rooms": {
			".read": "auth != null",
			"$roomId": {
				".write": "auth != null && (data.exists() ? data.child('members').child(auth.uid).val() === true : newData.child('members').child(auth.uid).val() === true)"
			}
		},
		"messages": {
			"$roomId": {
				".read": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true",
				"$messageId": {
					".write": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true && ((!data.exists() && newData.child('senderId').val() === auth.uid) || (data.exists() && data.child('senderId').val() === auth.uid))"
				}
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
- Add a server-side search index if global message search volume grows
- Add optional service worker if you need true background push notifications
