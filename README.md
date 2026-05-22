# Inkingi Construction Backend

Express and TypeScript backend for the Inkingi Construction application. The API uses Prisma with PostgreSQL, Better Auth for authentication, and Cloudinary support for media uploads.

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Better Auth
- Cloudinary

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the backend root:

```env
PORT=3000
NODE_ENV="development"

DATABASE_URL="postgres://1b7577af4e4408a9b7efe745cd28b2dc5df4403692d314d2673a73ac82f65f9b:sk_hu1J7juS-gjWYcl-HDq_f@db.prisma.io:5432/postgres?sslmode=require"
FRONTEND_URL="http://localhost:5173"

CLOUDINARY_CLOUD_NAME="dmaspnotz"
CLOUDINARY_API_KEY="232498513858291"
CLOUDINARY_API_SECRET="dQ0l4SVGXcxojesxk5K9VLN98ww"

BETTER_AUTH_SECRET="LpfTRRfQSy0luhYPfgNDuGcSDUhXqLJL"
BETTER_AUTH_URL="http://localhost:3000"

RESEND_API_KEY="your-resend-api-key"
```

For local development, copy the real `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `RESEND_API_KEY` values from your `.env` file. Do not commit real database URLs, auth secrets, or API keys.

Required environment variables:

```text
PORT
NODE_ENV
DATABASE_URL
FRONTEND_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
RESEND_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

`FRONTEND_URL` is used for CORS and Better Auth trusted origins.

### 3. Set up the database

Generate the Prisma client:

```bash
npm run db:generate
```

Push the schema to the database:

```bash
npm run db:push
```

Or create a development migration:

```bash
npm run db:migrate
```

### 4. Run the server

Development mode:

```bash
npm run dev
```

Start directly:

```bash
npm start
```

The server listens on:

```text
http://0.0.0.0:PORT
```

## Available Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Run the API with nodemon and tsx         |
| `npm start`           | Run the API with tsx                     |
| `npm run build`       | Compile TypeScript                       |
| `npm run db:generate` | Generate Prisma client                   |
| `npm run db:push`     | Push Prisma schema to the database       |
| `npm run db:migrate`  | Create and apply a development migration |

## API Routes

| Route   | Description        |
| ------- | ------------------ |
| `GET /` | Health check route |

Better Auth is mounted at:

```text
/api/auth
```

### Better Auth Routes

Core routes:

| Method         | Route                               | Description                      |
| -------------- | ----------------------------------- | -------------------------------- |
| `GET`          | `/api/auth/ok`                      | Check Better Auth status         |
| `POST`         | `/api/auth/sign-up/email`           | Sign up with email and password  |
| `POST`         | `/api/auth/sign-in/email`           | Sign in with email and password  |
| `POST`         | `/api/auth/sign-in/social`          | Start social sign-in flow        |
| `GET`          | `/api/auth/callback/:id`            | OAuth callback route             |
| `POST`         | `/api/auth/sign-out`                | Sign out current user            |
| `GET` / `POST` | `/api/auth/get-session`             | Get the current session          |
| `GET`          | `/api/auth/list-sessions`           | List current user sessions       |
| `POST`         | `/api/auth/revoke-session`          | Revoke one session               |
| `POST`         | `/api/auth/revoke-sessions`         | Revoke all current user sessions |
| `POST`         | `/api/auth/revoke-other-sessions`   | Revoke other sessions            |
| `POST`         | `/api/auth/update-session`          | Update current session data      |
| `POST`         | `/api/auth/update-user`             | Update current user              |
| `POST`         | `/api/auth/change-password`         | Change current user password     |
| `POST`         | `/api/auth/change-email`            | Change current user email        |
| `POST`         | `/api/auth/delete-user`             | Request or delete current user   |
| `GET`          | `/api/auth/delete-user/callback`    | Delete user callback route       |
| `POST`         | `/api/auth/request-password-reset`  | Request password reset email     |
| `GET`          | `/api/auth/reset-password/:token`   | Password reset callback route    |
| `POST`         | `/api/auth/reset-password`          | Reset password                   |
| `POST`         | `/api/auth/verify-password`         | Verify current password          |
| `POST`         | `/api/auth/send-verification-email` | Send verification email          |
| `GET`          | `/api/auth/verify-email`            | Verify email address             |
| `GET`          | `/api/auth/list-accounts`           | List linked accounts             |
| `POST`         | `/api/auth/link-social`             | Link a social account            |
| `POST`         | `/api/auth/unlink-account`          | Unlink an account                |
| `GET`          | `/api/auth/get-access-token`        | Get account access token         |
| `POST`         | `/api/auth/refresh-token`           | Refresh account token            |
| `GET`          | `/api/auth/account-info`            | Get linked account info          |
| `GET`          | `/api/auth/error`                   | Better Auth error route          |

Username plugin routes:

| Method | Route                             | Description                        |
| ------ | --------------------------------- | ---------------------------------- |
| `POST` | `/api/auth/sign-in/username`      | Sign in with username and password |
| `POST` | `/api/auth/is-username-available` | Check username availability        |

Phone number plugin routes:

| Method | Route                                           | Description                            |
| ------ | ----------------------------------------------- | -------------------------------------- |
| `POST` | `/api/auth/sign-in/phone-number`                | Sign in with phone number and password |
| `POST` | `/api/auth/phone-number/send-otp`               | Send phone verification OTP            |
| `POST` | `/api/auth/phone-number/verify`                 | Verify phone number OTP                |
| `POST` | `/api/auth/phone-number/request-password-reset` | Request phone password reset           |
| `POST` | `/api/auth/phone-number/reset-password`         | Reset password with phone OTP          |

Admin plugin routes:

| Method | Route                                  | Description                    |
| ------ | -------------------------------------- | ------------------------------ |
| `POST` | `/api/auth/admin/set-role`             | Set a user's role              |
| `GET`  | `/api/auth/admin/get-user`             | Get one user                   |
| `POST` | `/api/auth/admin/create-user`          | Create a user                  |
| `POST` | `/api/auth/admin/update-user`          | Update a user                  |
| `GET`  | `/api/auth/admin/list-users`           | List users                     |
| `POST` | `/api/auth/admin/list-user-sessions`   | List sessions for a user       |
| `POST` | `/api/auth/admin/ban-user`             | Ban a user                     |
| `POST` | `/api/auth/admin/unban-user`           | Unban a user                   |
| `POST` | `/api/auth/admin/impersonate-user`     | Impersonate a user             |
| `POST` | `/api/auth/admin/stop-impersonating`   | Stop impersonating             |
| `POST` | `/api/auth/admin/revoke-user-session`  | Revoke one user session        |
| `POST` | `/api/auth/admin/revoke-user-sessions` | Revoke all sessions for a user |
| `POST` | `/api/auth/admin/remove-user`          | Remove a user                  |
| `POST` | `/api/auth/admin/set-user-password`    | Set a user's password          |
| `POST` | `/api/auth/admin/has-permission`       | Check admin permissions        |

## Project Structure

```text
src/
  app.ts                    Express app entry point
  lib/
    auth.ts                 Better Auth configuration
    cloudinary.ts           Cloudinary configuration
    prisma.ts               Prisma client setup
  middleware/
    auth.middleware.ts      Auth middleware
    upload.middleware.ts    Upload middleware
  types/
    express.d.ts            Express type extensions
prisma/
  schema.prisma             Database schema
```

## Database Models

The current Prisma schema contains Better Auth related models:

- `User`
- `Session`
- `Account`
- `Verification`

## Notes

- Make sure `DATABASE_URL` points to a running PostgreSQL database before running Prisma commands.
- The default frontend origin is `http://localhost:5173` when `FRONTEND_URL` is not provided.
- Cloudinary environment variables are required when using upload functionality.
