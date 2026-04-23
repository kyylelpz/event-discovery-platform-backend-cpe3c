# Event Discovery Platform Backend

Backend API for the Event Discovery Platform / Eventcinity. This repository provides the Express server, MongoDB access layer, authentication, event and profile APIs, mock catalog syncing, notifications, and integrations such as Google OAuth, Cloudinary, SerpAPI, and email delivery.

## Related Repository

- Frontend app: [event-discovery-platform-cpe3c](https://github.com/kyylelpz/event-discovery-platform-cpe3c)

## What This API Does

- Serves authentication and session endpoints
- Stores and retrieves real users plus `mock_users`
- Stores and retrieves event data from separate MongoDB databases
- Supports event discovery, created events, and saved events
- Handles profile reads and profile updates
- Supports social interactions such as follow, save, favorite, and attending
- Generates notification data for account activity
- Syncs mock users and mock events at startup

## Tech Stack

- Node.js 24.x
- Express
- MongoDB + Mongoose
- Passport Google OAuth
- JWT cookie-based auth
- Cloudinary for image uploads
- SerpAPI for event ingestion/refresh
- Resend or Brevo for OTP / transactional email

## Requirements

- Node.js `24.x`
- npm
- MongoDB Atlas connection strings
- Environment variables configured in `.env`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Copy `.env.sample` to `.env`, then update the values for your environment.

### 3. Start the server

```bash
npm run dev
```

By default, the API runs on `http://localhost:5000`.

## Available Scripts

| Script | Description |
| --- | --- |
| `npm start` | Starts the server with Node |
| `npm run dev` | Starts the server with Node |
| `npm run dev:watch` | Starts the server in watch mode |
| `npm run dev:nodemon` | Starts the server with Nodemon |

## Project Structure

```text
src/
  data/          Seed/mock event and user data
  middleware/    Express middleware such as auth protection
  models/        Mongoose models
  routes/        API route modules
  services/      Catalog sync, email, and domain services
  utils/         Shared helpers such as password and cloudinary logic
  server.js      Server bootstrap and route registration
```

## API Overview

### Health

- `GET /api/health`

### Auth

- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/verify-email/resend`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Events

- `GET /api/events`
- `GET /api/events/status`
- `POST /api/events/refresh`
- `GET /api/events/:eventId`
- `POST /api/events/create`
- `PUT /api/events/:eventId`
- `GET /api/events/created/me`
- `GET /api/events/created/by/:username`
- `POST /api/events/save`
- `GET /api/events/saved`
- `DELETE /api/events/saved/:eventId`

### Profile and People

- `GET /api/profile`
- `GET /api/profile/me`
- `PUT /api/profile`
- `PUT /api/profile/me`
- `GET /api/profile/:username`
- `GET /api/users`
- `POST /api/users/:username/follow`
- `DELETE /api/users/:username/follow`

### Interactions and Notifications

- `GET /api/interactions`
- `PUT /api/interactions/:eventId`
- `GET /api/interactions/public/:username/attending`
- `GET /api/interactions/:eventId/following-attendees`
- `GET /api/notifications`
- `DELETE /api/notifications/:notificationId`

## Database Layout

This backend opens two MongoDB connections:

- User database: defaults to `Userplatform`
- Event database: defaults to `Eventdata`

Related code:

- Connection setup: `src/routes/db.js`
- User collections: includes `users` and `mock_users`
- Event collections: includes live events, created events, mock events, saved events, notifications, and interaction records

## Environment Variables

### Core server / database

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Recommended | `development` or `production` |
| `PORT` / `APP_PORT` | Optional | Server port, default is `5000` |
| `MONGO_URI` | Yes | MongoDB connection string for the user database |
| `USER_DB_NAME` | Optional | Overrides default user DB name `Userplatform` |
| `MONGO_URI_EVENT` | Yes | MongoDB connection string for the event database |
| `EVENT_DB_NAME` | Optional | Overrides default event DB name `Eventdata` |
| `JWT_SECRET` | Yes | Secret used to sign auth tokens |

### Frontend / CORS / redirects

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLIENT_URL` | Yes | Primary frontend origin |
| `CLIENT_URLS` | Recommended | Comma-separated list of allowed frontend origins |
| `COOKIE_DOMAIN` | Optional | Shared cookie domain for production subdomains |
| `AUTH_SUCCESS_REDIRECT_URL` | Recommended | Frontend redirect after successful auth |
| `AUTH_FAILURE_REDIRECT_URL` | Recommended | Frontend redirect after failed auth |

### Google OAuth

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | If using Google sign-in | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | If using Google sign-in | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | If using Google sign-in | OAuth callback URL for this backend |

### Email delivery

| Variable | Required | Purpose |
| --- | --- | --- |
| `EMAIL_PROVIDER` | If using OTP email | `resend` or `brevo` |
| `EMAIL_FROM_ADDRESS` | Recommended | Sender email address |
| `EMAIL_FROM_NAME` | Recommended | Sender display name |
| `EMAIL_FROM_DOMAIN` | Recommended | Sending domain |
| `RESEND_API_KEY` | If `EMAIL_PROVIDER=resend` | Resend API key |
| `RESEND_FROM_EMAIL` | Optional | Resend sender email override |
| `RESEND_FROM_NAME` | Optional | Resend sender name override |
| `BREVO_API_KEY` | If `EMAIL_PROVIDER=brevo` | Brevo API key |
| `BREVO_FROM_EMAIL` | Optional | Brevo sender email override |
| `BREVO_FROM_NAME` | Optional | Brevo sender name override |

### Media and external data

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | If uploading images | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | If uploading images | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | If uploading images | Cloudinary API secret |
| `EVENT_IMAGE_MAX_SIZE_MB` | Optional | Max event image size |
| `AVATAR_IMAGE_MAX_SIZE_MB` | Optional | Max avatar image size |
| `SERPAPI_KEY` | If refreshing external events | SerpAPI key |
| `EVENTS_REFRESH_TOKEN` | Optional | Protects the manual refresh endpoint |
| `EVENTS_REFRESH_QUERY` | Optional | Default event refresh query |

## Local Development Example

Example values for local development:

```env
NODE_ENV=development
PORT=5000

MONGO_URI=your_user_db_connection_string
MONGO_URI_EVENT=your_event_db_connection_string
JWT_SECRET=replace_this_with_a_real_secret

CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
AUTH_SUCCESS_REDIRECT_URL=http://localhost:5173/events
AUTH_FAILURE_REDIRECT_URL=http://localhost:5173/signin
```

Add Google, email, Cloudinary, and SerpAPI credentials only if you are using those features locally.

## Frontend Integration

The paired frontend repo defaults to `http://localhost:5000` as its API base URL when running on localhost. For local development:

1. Start this backend first
2. Set `CLIENT_URL` / `CLIENT_URLS` to the frontend dev origin
3. Start the frontend repo
4. Verify `GET /api/health` and then load the frontend app

## Startup Behavior

On server startup, the backend automatically attempts to:

- sync the mock event catalog
- sync the mock user catalog

This helps keep demo content available for the frontend even before manual data entry.

## Deployment

This backend is designed to be deployed as a separate Node.js web app.

### Hostinger deployment notes

- Framework: `Express.js` or `Other`
- Entry file: `src/server.js`
- Node.js version: `24.x`
- Install command: `npm install`
- Start command: `npm start`

### Deployment checklist

1. Provision the Node.js app
2. Set all environment variables in the hosting dashboard
3. Do not commit production secrets to `.env`
4. Point the frontend repo to the deployed backend URL
5. Set CORS, callback URLs, and redirect URLs to the deployed frontend domain
6. If using shared auth cookies across subdomains, set `COOKIE_DOMAIN` accordingly
7. Verify MongoDB Atlas network access and credentials
8. Verify Cloudinary, email provider, and Google OAuth configuration if those features are enabled

## Notes

- `.env.sample` is the starting template for configuration
- OTP email delivery will not work until an email provider is configured
- Image uploads require Cloudinary credentials
- Event refresh from external sources requires `SERPAPI_KEY`
