# 📋 COURSE PROJECT REPORT

## DOSTHU - REAL-TIME CHAT APPLICATION
**Subject:** Full Stack Web Development (FSWD)  
**Academic Year:** 2026  
**Project Category:** Course Based Project (CBS)  

---

## 1. ABSTRACT
Modern web applications demand instantaneous data synchronization without requiring repetitive user manual refreshes. Traditional HTTP request-response paradigms introduce high latency and unnecessary overhead when applied to communication software. **Dosthu** (meaning *"Friend/Buddy"*) is a full-stack real-time messaging application designed to provide zero-latency, one-to-one communication with a visually striking, aesthetic user interface. 

The application implements a robust client-server architecture built on **Node.js**, **WebSockets (RFC-6455)**, **RESTful APIs**, and a persistent document database. Key capabilities include secure cryptographic registration/login (PBKDF2 + JWT), real-time message dispatching, dynamic online/offline presence tracking, live animated typing indicators, delivery and read receipts (double checkmarks), profile personalization with custom vector avatars, and Web Audio API synthesized feedback.

---

## 2. OBJECTIVES & SCOPE
The core objectives of the Dosthu project are:
1. **Demonstrate Full Stack Architecture:** Integrate frontend view layers, HTTP REST endpoints, bidirectional socket servers, and persistent data storage.
2. **Real-Time Data Exchange:** Achieve two-way event synchronization using WebSockets, replacing legacy polling techniques.
3. **Robust Security Implementation:** Protect user credentials through salted PBKDF2 password hashing and secure token-based authentication (JWT).
4. **Interactive & Aesthetic UI/UX:** Deliver a modern glassmorphism aesthetic with ambient lighting, animated transitions, synthesized auditory feedback, and fluid responsiveness across desktop and mobile form factors.
5. **Presence & State Management:** Maintain active connection pools to accurately reflect peer presence (online/offline) and activity (typing/idle).

---

## 3. SYSTEM REQUIREMENTS

### Hardware Requirements
- **Processor:** Dual-Core 1.8 GHz or higher
- **RAM:** 2 GB minimum (4 GB recommended)
- **Disk Storage:** 50 MB available workspace storage
- **Network:** Localhost or LAN/Internet connection

### Software Requirements
- **Operating System:** Windows 10/11, macOS, or Linux
- **Runtime Environment:** Node.js (v18.0.0 or higher)
- **Web Browser:** Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari with Web Audio and WebSocket support
- **Development Tools:** Visual Studio Code / Modern IDE

---

## 4. ARCHITECTURAL & SYSTEM DESIGN

### 4.1 Client-Server Paradigm
Dosthu employs a decoupled client-server architecture:
- **Client (Frontend):** A Single Page Application (SPA) developed with modular HTML5, CSS3 (Custom properties, Flexbox, CSS Grid, Glassmorphism), and Vanilla JavaScript. The client maintains both a persistent WebSocket stream for low-latency events and asynchronous Fetch calls for initial resource loads and updates.
- **Server (Backend):** A Node.js server that simultaneously serves static assets, executes RESTful API endpoints for authentication and user management, and manages an RFC-6455 compliant WebSocket server on the same port.
- **Data Layer:** A persistent document database (`data/dosthu.json`) with atomic file writes to prevent race conditions or data corruption during concurrent message deliveries.

### 4.2 WebSockets vs Traditional HTTP Polling

| Parameter | Traditional HTTP Polling | WebSockets (Used in Dosthu) |
| :--- | :--- | :--- |
| **Protocol** | Stateless HTTP request/response | Stateful TCP bidirectional connection |
| **Header Overhead** | High (~800 bytes per request) | Minimal (2 to 10 bytes frame header) |
| **Latency** | Dependent on polling interval (1-5s) | Sub-millisecond instant dispatch |
| **Server Load** | Continuous redundant requests | Event-driven notification only on activity |
| **Full Duplex** | Half-duplex simulation | True full-duplex communication |

---

## 5. DATABASE DESIGN & SCHEMA

The application stores entities in a normalized document structure consisting of two primary collections: `users` and `messages`.

### 5.1 Users Collection Schema

| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Primary Key, Unique | Unique identifier (e.g. `usr_harish`) |
| `username` | String | Unique, Indexed | Lowercase user handle (min 3 chars) |
| `name` | String | Required | Full display name |
| `email` | String | Unique, Valid Email | Email address for contact |
| `password` | String | Hashed (`salt:hash`) | Salted PBKDF2 cryptographic digest |
| `avatar` | String | Required | Avatar preset identifier (e.g. `avatar-1`) |
| `bio` | String | Optional | Custom user status / biography |
| `status` | String | 'online' \| 'offline' | Connection state |
| `lastSeen` | Number | Timestamp (ms) | Epoch timestamp of last active session |
| `createdAt` | Number | Timestamp (ms) | Account creation timestamp |

### 5.2 Messages Collection Schema

| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Primary Key, Unique | Unique message ID (e.g. `msg_a7b9`) |
| `senderId` | String | Foreign Key ➔ Users | ID of user sending the message |
| `receiverId` | String | Foreign Key ➔ Users | ID of user receiving the message |
| `text` | String | Required | Text or emoji content of message |
| `type` | String | 'text' \| 'emoji' | Message formatting type |
| `read` | Boolean | Default: `false` | Read receipt flag |
| `readAt` | Number | Nullable | Epoch timestamp when message was read |
| `createdAt` | Number | Timestamp (ms) | Epoch timestamp when message was created |

---

## 6. SECURITY & CRYPTOGRAPHY

1. **Password Hashing (PBKDF2):**
   - Implemented via Node's native `crypto.pbkdf2Sync` using SHA-512 with 100,000 iterations and a cryptographically generated 16-byte random salt.
   - Output stored as `salt:hash`.
   - Verification uses `crypto.timingSafeEqual` to prevent side-channel timing attacks.

2. **Session Security (JWT):**
   - Tokens are signed with HMAC-SHA256 (`alg: HS256`).
   - Tokens contain user ID, username, and an expiration timestamp (`exp`).
   - Delivered both as an HTTP Bearer authorization token and an `HttpOnly` cookie to safeguard against unauthorized client script tampering.

3. **Input Sanitization & XSS Prevention:**
   - All message payloads and user names are sanitized via DOM text node encoding before being rendered to the DOM tree, eliminating Cross-Site Scripting (XSS) risks.

---

## 7. AESTHETICS & UI/UX HIGHLIGHTS

- **Glassmorphism:** Crafted using `backdrop-filter: blur(20px)` with translucent containers (`rgba(17, 24, 39, 0.72)`) and gradient border highlights.
- **Web Audio API Synth Engine:** Provides feedback audio cues without loading large external sound files. Synthesizes a soft ascending sine wave pop for message dispatch and a dual-frequency chord for message arrival.
- **Micro-Interactions:** Pulsing status dots with radiating ripple rings, bouncing 3-dot typing animations, and kinetic reaction pop effects.
- **Theme Versatility:** Instant Dark/Light mode toggle stored in `localStorage`.

---

## 8. VIVA / ORAL EXAMINATION PREPARATION (Q&A)

Here are the top questions frequently asked by examiners for Full Stack Web Development projects:

### Q1: What is the difference between WebSockets and HTTP?
**Answer:** HTTP is a half-duplex, stateless protocol where every exchange requires a client request followed by a server response, carrying significant header overhead. WebSockets provide a full-duplex, persistent TCP connection over a single socket, allowing the server to push data to the client instantly with minimal frame overhead (2-10 bytes) as soon as an event occurs.

### Q2: How does the WebSocket handshake work?
**Answer:** The client initiates a standard HTTP GET request with the headers `Upgrade: websocket` and `Connection: Upgrade`, along with a random `Sec-WebSocket-Key`. The server hashes this key with the standard GUID (`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`) using SHA-1, base64-encodes it into `Sec-WebSocket-Accept`, and responds with HTTP status `101 Switching Protocols`. After this handshake, both parties communicate using binary WebSocket frames.

### Q3: How do you handle password storage securely?
**Answer:** Passwords should never be stored in plain text. Dosthu uses PBKDF2 (Password-Based Key Derivation Function 2) with SHA-512 and 100,000 iterations combined with a unique 16-byte cryptographically secure random salt per user. This prevents dictionary and precomputed rainbow table attacks.

### Q4: How are Read Receipts implemented?
**Answer:** When User A sends a message to User B, it is initially stored with `read: false` (rendering a single checkmark `✓` for User A). When User B selects or views User A's chat, the client sends a `mark_read` socket event. The server updates the database records to `read: true` and dispatches a `messages_read` event back to User A's active socket, dynamically updating User A's checkmarks to blue double ticks (`✓✓`).

### Q5: How is user typing status handled without overwhelming the network?
**Answer:** The frontend uses **debouncing**. When a user types in the input box, a `typing_start` event is emitted. A timer is set for 1.5 seconds; if no subsequent keystroke occurs within that window, a `typing_stop` event is dispatched. This ensures typing states remain accurate without spamming socket frames on every key press.

---

## 9. CONCLUSION & FUTURE ENHANCEMENTS
Dosthu successfully accomplishes all functional and non-functional requirements set out for the Full Stack Web Development course. It demonstrates real-time bidirectional synchronization, defensive security measures, persistent data storage, and an attractive, responsive UI.

### Potential Future Enhancements:
1. **WebRTC Integration:** Peer-to-peer live audio and video streaming.
2. **End-to-End Encryption (E2EE):** Client-side message encryption using the Signal Protocol / Diffie-Hellman key exchange.
3. **Group Conversations:** Multi-user group rooms with admin permissions.
4. **Cloud Database Migration:** Seamless transition to MongoDB Atlas or AWS DynamoDB via the established database repository interface.
