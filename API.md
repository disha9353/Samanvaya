# EcoBarter+ API (REST)

Base URL: `http://localhost:5000/api`

## Auth
- `POST /auth/register`
  - body: `{ name, email, password, role?: "user"|"collector" }`
- `POST /auth/login`
  - body: `{ email, password }`
- `POST /auth/refresh`
  - body: `{ refreshToken }`
- `GET /auth/me`
  - auth: required

## Items / Reuse feed
- `POST /items` (create item)
  - auth: required
  - body: `{ title, description?, images: string[], price }`
- `GET /items?q=&status=&page=&limit=`
- `GET /items/:id`
- `PATCH /items/:id` (seller only)
- `DELETE /items/:id` (seller only)
- `GET /items/me` (your inventory)
- `POST /items/:id/like` (toggle)
- `POST /items/:id/save` (toggle)
- `POST /items/:id/interested`

## Interests
- `GET /interests/my` (items you’re interested in)

## Wallet / Credits
- `GET /wallet/summary`
- `GET /wallet/transactions?type=&limit=`
- `POST /wallet/transfer`
  - body: `{ toUserId, credits, meta? }`

## QR Payments
- `POST /qr/generate`
  - auth: seller
  - body: `{ buyerId, itemId }`
  - returns: `{ qrToken }`
- `POST /qr/validate-and-pay`
  - auth: buyer
  - body: `{ qrToken }`

## Barter
- `POST /barter/requests`
  - auth: fromUser
  - body: `{ offeredItemId, requestedItemId, credits? }`
- `GET /barter/requests/me?incoming=true|false`
  - auth required
- `POST /barter/requests/:id/accept`
  - auth: toUser
- `POST /barter/requests/:id/reject`
  - auth: toUser

## Chat (REST + Socket.io)
- `POST /chat/messages`
  - auth required
  - body: `{ receiverId, itemId?, content }`
- `GET /chat/messages/:otherUserId?itemId=`

### Socket.io
Client connects with JWT access token.
- Event: `chat:send` (optional; server also broadcasts when REST is used)
- Event: `chat:message` (incoming)

## Waste Collection
User:
- `POST /waste/requests`
  - auth required
  - body: `{ wasteType, quantity, location:{lat,lng}, date, timeSlot, address? }`
- `GET /waste/requests/me`

Collector:
- `GET /collectors/requests`
- `POST /collectors/requests/:id/accept`
- `POST /collectors/requests/:id/complete`
  - body: `{ weightKg, pricePerKg }`

## Notifications
- `GET /notifications`
- `POST /notifications/:id/read`

## Eco
- `GET /eco/leaderboard?limit=`

## Media Upload (Cloudinary)
- `POST /media/upload`
  - multipart/form-data
  - form field: `files` (multiple)

