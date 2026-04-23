# EVENTCINITY – Backend

Eventcinity Backend is a **Node.js + Express REST API** that handles authentication, event management, user data, and integrations with external services.

---

## Live Links

- API: https://api.eventcinity.com  
- Health Check: https://api.eventcinity.com/api/health  

---

## Overview

This backend provides:
- Authentication (JWT + Google OAuth)
- Event management (CRUD operations)
- User profiles and social interactions
- Notifications system
- External integrations (SerpAPI, Cloudinary, Email)

---

## Tech Stack

- Node.js 24.x
- Express.js
- MongoDB Atlas + Mongoose
- JWT Authentication
- Passport Google OAuth

### Integrations
- Cloudinary (image uploads)
- SerpAPI (event data)
- Resend (email services)

---

## System Architecture

```
Frontend (React)
   ↓
Express API
   ↓
MongoDB Atlas
   ↓
External APIs
```

---

## Project Structure

```
src/
  routes/        API endpoints
  models/        Database models
  middleware/    Auth and validation
  services/      Business logic
  utils/         Helpers
  data/          Mock data
  server.js      Entry point
```

---

## API Endpoints

### Health
```
GET /api/health
```

### Auth
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Events
```
GET    /api/events
POST   /api/events/create
PUT    /api/events/:eventId
GET    /api/events/:eventId
```

### Profile & Users
```
GET /api/profile
PUT /api/profile
GET /api/users
POST /api/users/:username/follow
```

### Interactions & Notifications
```
GET /api/interactions
GET /api/notifications
```

---

## 🗄️ Database Design

Two MongoDB databases:

| Database | Purpose |
|--------|--------|
| Userplatform | User data |
| Eventdata | Events and interactions |

---

## ⚙️ Environment Configuration

Create `.env` file:

```
PORT=5000
MONGO_URI=your_user_db
MONGO_URI_EVENT=your_event_db
JWT_SECRET=your_secret

CLIENT_URL=https://www.eventcinity.com
CLIENT_URLS=https://eventcinity.com,https://www.eventcinity.com
```

---

## Getting Started

### 1. Install dependencies
```
npm install
```

### 2. Run server
```
npm run dev
```

Server runs at:
```
https://api.eventcinity.com
```

---

## Authentication Flow

1. User logs in
2. Server validates credentials
3. JWT stored in HTTP-only cookie
4. Requests authenticated via cookies

---

## Deployment

### Hostinger Setup
- Entry file: `src/server.js`
- Node version: 24.x

### Start command
```
npm start
```

### Checklist
- Set environment variables
- Configure MongoDB Atlas access
- Configure OAuth and external APIs
- Set correct CORS origins

---

## Startup Behavior

On server start:
- Sync mock users
- Sync mock events

---

## Developers

- Reymel Aquino  
- Jana Daniela Bautista  
- Lance Angelo Bernal  
- Euan Francisco  
- Kyle Lemuel Lopez  