# Chatroom App - CS2410 Midterm Project

## 1. Project Title & Introduction

**Chatroom App - CS2410 Midterm Project**

This project is a fully functional web-based chatroom that uses Firebase for real-time messaging, authentication, and database management. It is built for the Software Studio course (CS2410 at NTHU) and demonstrates a production-style chat experience with private/group rooms, rich messaging, and interactive UI features.

---

## 2. Features & Functionalities

### Basic Components
- **Membership Mechanism:** Email Sign Up and Sign In.
- **Hosted on Firebase Hosting.**[link](https://midterm-chatroom-6afb8.web.app)
- **Authenticated Database Read/Write** for all chat data.
- **Responsive Web Design (RWD)**: layout adapts to small screens without missing UI elements.
- **Chatroom logic:**
  - Private chatrooms
  - Load chat history
  - Invite new members (group chat)

### Advanced Components
- **User Profile (Modal/Page):** Edit profile picture, Username, Email, Phone number, and Address. Username and avatar appear in chat.
- **Message Operations:** Unsend and edit own messages, search messages, send/unsend images.
- **CSS Animation:** **Animated chatroom boxes** highlighted UI animation on chat room cards.

### Bonus Components
- **Gemini Chatbot Integration** (Gemini API).
- **Block User:** Messages are mutually hidden and a warning appears in the chat UI, showing warning
- **GIF Sending** with Giphy API.
- **Emoji Reactions** on messages.
- **Reply Threads:** Reply to a specific message, show reply preview above the input, and click to scroll/highlight the original message.

---

## 3. Operation Guide (How to Use)

1. **Register / Sign In**
   - Use email + password to sign up or sign in.
2. **Join or Create Chatrooms**
   - Create or select a chatroom from the left panel.
   - For group chats, add multiple users and create a group.
3. **Invite Friends**
   - Search users by username or email, then add them to a group.
4. **Chat & Manage Messages**
   - Send text, images, GIFs, and react with emojis.
   - Edit or unsend your own messages.
5. **Reply to Messages**
   - Click Reply on any message to thread responses and jump back to the original.
6. **Block Users**
   - Block a user in a private room or group; their messages are hidden and a warning appears.
7. **Use the Gemini Chatbot**
   - Open the AI Assistant room and ask questions.

---

## 4. Local Setup Instructions (STEP BY STEP)

> These steps are required for TA grading. Please follow in order.

1. **Clone the repository**

```
git clone https://github.com/chuangtsh/ss_midterm.git
cd my-app
```

2. **Install dependencies**

```
npm install
```

3. **Create environment variables**

Create a `.env.local` file in the project root with the following keys:

```
VITE_GEMINI_API_KEY=YOUR_GEMINI_KEY
VITE_GIPHY_API_KEY=YOUR_TENOR_KEY
```

> Firebase config is stored in [firebase_config.js](firebase_config.js). Update it only if you want to use your own Firebase project.

4. **Run the development server**

```
npm run dev
```

The app will be available at the local URL shown in the terminal.

---

## 5. Additional Notes

- Git was used for regular version control throughout development.
- **Deployment URL (replace this):**
  - Firebase Hosting URL: **[https://midterm-chatroom-6afb8.web.app]**
