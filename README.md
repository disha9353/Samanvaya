# EcoBarter+ – Circular Economy Platform

Reuse + barter marketplace + waste collection scheduling with credits wallet, real-time chat, QR payments, and eco impact tracking.

## What you get (demo-ready)
- Social reuse feed (Instagram-like): items, images, like/save, Interested
- Credits wallet (Paytm-like): wallet ledger for every credits movement
- Barter exchange: offer item + requested item + optional extra credits
- QR payments: signed QR token + validate-and-pay transfers credits + marks item Sold
- Waste collection: request pickup, collector accept/complete with weight + price/kg
- Real-time chat: Socket.io + REST persistence (works with PWA offline sync)
- Eco impact: CO2 saved + eco score + leaderboard

## Tech stack
- Frontend: React + Vite + Tailwind + Redux Toolkit + Socket.io client + PWA (Workbox)
- Backend: Node.js + Express + Socket.io + MongoDB + Mongoose

## Folder structure
- `backend/` – Express API + Socket.io + Mongoose models
- `frontend/` – React PWA

## Setup (local)
### 1) Prerequisites
- Node.js (18+ recommended)
- MongoDB running locally (or change `MONGODB_URI`)
- Cloudinary account (for image upload) – optional but required for Create Item images
  - If you skip Cloudinary, item creation with images will fail (QR/waste/chat still work).

### 2) Backend
```powershell
cd backend
npm install
copy .env.example .env

# Start (requires MongoDB running)
npm run dev
```

Seed sample data:
```powershell
node .\src\scripts\seed.js
```

Sample accounts (from seed):
- `asha@example.com` / `password123` (user)
- `rahul@example.com` / `password123` (user)
- `collector@example.com` / `password123` (collector)
- `admin@gmail.com` / `admin123` (admin)

### 3) Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Visit: `http://localhost:5173`

## Working demo flow (end-to-end)
1. **Login**
   - Use one of the seeded users (asha / rahul) and then login as the collector.
2. **Reuse marketplace**
   - Go to **Feed** → open an item → click **Interested**
3. **Chat**
   - From the item page click **Chat** and send a message (real-time).
4. **Barter**
   - Open your item → if you have an item you can offer, use **Barter offer**.
   - Switch to the other user → **Dashboard** → accept/reject barter.
5. **QR payment**
   - On the seller side (item owner), generate QR using **QR payment**.
   - On the buyer side, scan QR (or paste the token) to transfer credits and mark item **Sold**.
6. **Waste collection**
   - User: **Waste pickup** → fill waste type, quantity, date/time, pick location → request pickup.
   - Collector: **Dashboard** (collector mode) → accept → complete (weight + price/kg) → collector earns credits.
7. **Eco impact**
   - Open **Profile** → see eco leaderboard updates from waste + barter.

## API documentation
See [`API.md`](./API.md).

## Notes for judge/demo
- Credits are prevented from going negative via atomic wallet transfers.
- Chat messages are persisted via REST and broadcast via Socket.io when online; PWA background sync retries message writes when offline.

