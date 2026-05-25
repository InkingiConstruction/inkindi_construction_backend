# Inkingi Construction Backend

Express and TypeScript backend for the Inkingi Construction application. The API uses Prisma with PostgreSQL, Better Auth for authentication, Cloudinary for media uploads, Resend for email, and Africa's Talking for SMS.

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Better Auth
- Cloudinary
- Resend
- Africa's Talking
- Multer

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
MOBILE_URL="http://localhost:8081"
CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:8081,http://192.168.1.171:8081"

BETTER_AUTH_SECRET=LpfTRRfQSy0luhYPfgNDuGcSDUhXqLJL
BETTER_AUTH_URL=http://localhost:3000

RESEND_API_KEY="re_LeThRRgr_8pDGZBZVzndjF5r9am3hCcgR"

CLOUDINARY_CLOUD_NAME="dmaspnotz"
CLOUDINARY_API_KEY="232498513858291"
CLOUDINARY_API_SECRET="dQ0l4SVGXcxojesxk5K9VLN98ww"

AT_API_KEY=atsk_d3c24bdffe129690449da47abffe775cfe325f9c6b31d0c1d64e364a783f0da0fb941d2c
AT_USERNAME=sandbox
AT_SENDER_ID=INKINGICONSTRUCTION
```

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
AT_API_KEY
AT_USERNAME
AT_SENDER_ID
```

Optional environment variables:

```text
MOBILE_URL
CORS_ORIGINS
```

`FRONTEND_URL`, `MOBILE_URL`, and `CORS_ORIGINS` are used for CORS. In development, local network origins such as `localhost`, `127.0.0.1`, `10.x.x.x`, `172.16.x.x` to `172.31.x.x`, and `192.168.x.x` are also allowed.

Better Auth uses the v1 API base path:

```text
/api/v1/auth
```

`BETTER_AUTH_URL` should stay as the server origin, for example `http://localhost:3000`. Do not use the old `/api/auth` path.

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

Open Prisma Studio:

```bash
npm run db:studio
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
| `npm run db:studio`   | Open Prisma Studio                       |

## API Routes

| Route   | Description        |
| ------- | ------------------ |
| `GET /` | Health check route |

Better Auth is mounted at:

```text
/api/v1/auth
```

Example auth URL:

```text
http://localhost:3000/api/v1/auth/sign-in/email
```

KYC routes are mounted at:

```text
/api/v1/kyc
```

Swagger documentation is available at:

```text
/api/v1/docs
```

The raw OpenAPI JSON is available at:

```text
/api/v1/openapi.json
```

Model routes use this standard controller and route pattern:

| Method   | Path        | Controller action |
| -------- | ----------- | ----------------- |
| `POST`   | `/`         | `createModel`     |
| `GET`    | `/`         | `getModels`       |
| `GET`    | `/:id`      | `getModelById`    |
| `PUT`    | `/:id`      | `updateModel`     |
| `DELETE` | `/:id`      | `deleteModel`     |

### Model Route Mounts

| Base route              | Controller                  | Route file                       |
| ----------------------- | --------------------------- | -------------------------------- |
| `/api/v1/users`            | `user.controller.ts`        | `user.route.ts`                  |
| `/api/v1/sessions`         | `session.controller.ts`     | `session.route.ts`               |
| `/api/v1/accounts`         | `account.controller.ts`     | `account.route.ts`               |
| `/api/v1/verifications`    | `verification.controller.ts` | `verification.route.ts`          |
| `/api/v1/projects`         | `project.controller.ts`     | `project.route.ts`               |
| `/api/v1/project-members`  | `project-member.controller.ts` | `project-member.route.ts`     |
| `/api/v1/escrow-accounts`  | `escrow-account.controller.ts` | `escrow-account.route.ts`     |
| `/api/v1/transactions`     | `transaction.controller.ts` | `transaction.route.ts`           |
| `/api/v1/milestones`       | `milestone.controller.ts`   | `milestone.route.ts`             |
| `/api/v1/boq-items`        | `boq-item.controller.ts`    | `boq-item.route.ts`              |
| `/api/v1/rfqs`             | `rfq.controller.ts`         | `rfq.route.ts`                   |
| `/api/v1/quotes`           | `quote.controller.ts`       | `quote.route.ts`                 |
| `/api/v1/purchase-orders`  | `purchase-order.controller.ts` | `purchase-order.route.ts`     |
| `/api/v1/deliveries`       | `delivery.controller.ts`    | `delivery.route.ts`              |
| `/api/v1/progress-photos`  | `progress-photo.controller.ts` | `progress-photo.route.ts`     |
| `/api/v1/inspections`      | `inspection.controller.ts`  | `inspection.route.ts`            |
| `/api/v1/disputes`         | `dispute.controller.ts`     | `dispute.route.ts`               |
| `/api/v1/dispute-evidence` | `dispute-evidence.controller.ts` | `dispute-evidence.route.ts` |
| `/api/v1/messages`         | `message.controller.ts`     | `message.route.ts`               |
| `/api/v1/notifications`    | `notification.controller.ts` | `notification.route.ts`          |
| `/api/v1/audit-logs`       | `audit-log.controller.ts`   | `audit-log.route.ts`             |
| `/api/v1/activity-logs`    | `activity-log.controller.ts` | `activity-log.route.ts`          |
| `/api/v1/api-keys`         | `api-key.controller.ts`     | `api-key.route.ts`               |
| `/api/v1/system-settings`  | `system-setting.controller.ts` | `system-setting.route.ts`     |
| `/api/v1/email-templates`  | `email-template.controller.ts` | `email-template.route.ts`     |

### Role Access

All model routes require authentication through `requiredAuth`. Route-level role access is handled with `requireRole`.

| Base route              | Create | Read | Update | Delete |
| ----------------------- | ------ | ---- | ------ | ------ |
| `/api/v1/users`            | admin | admin | admin | admin |
| `/api/v1/sessions`         | admin | admin | admin | admin |
| `/api/v1/accounts`         | admin | admin | admin | admin |
| `/api/v1/verifications`    | admin | admin | admin | admin |
| `/api/v1/projects`         | client | client, engineer, supervisor, supplier, admin | client, engineer, admin | client, admin |
| `/api/v1/project-members`  | client, engineer, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, admin |
| `/api/v1/escrow-accounts`  | admin | client, engineer, admin | admin | admin |
| `/api/v1/transactions`     | client, admin | client, engineer, admin | admin | admin |
| `/api/v1/milestones`       | engineer, admin | client, engineer, supervisor, admin | engineer, supervisor, admin | engineer, admin |
| `/api/v1/boq-items`        | engineer, admin | client, engineer, supervisor, supplier, admin | engineer, admin | engineer, admin |
| `/api/v1/rfqs`             | engineer, admin | engineer, supplier, admin | engineer, admin | engineer, admin |
| `/api/v1/quotes`           | supplier | engineer, supplier, admin | supplier, engineer, admin | supplier, admin |
| `/api/v1/purchase-orders`  | engineer, admin | engineer, supplier, admin | supplier, engineer, admin | admin |
| `/api/v1/deliveries`       | supplier | client, engineer, supplier, admin | supplier, engineer, client, admin | supplier, admin |
| `/api/v1/progress-photos`  | engineer, supervisor, admin | client, engineer, supervisor, admin | engineer, supervisor, admin | engineer, supervisor, admin |
| `/api/v1/inspections`      | supervisor, admin | client, engineer, supervisor, admin | supervisor, admin | supervisor, admin |
| `/api/v1/disputes`         | client, engineer, supplier | client, engineer, supplier, admin | admin | admin |
| `/api/v1/dispute-evidence` | client, engineer, supplier | client, engineer, supplier, admin | client, engineer, supplier, admin | client, engineer, supplier, admin |
| `/api/v1/messages`         | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin |
| `/api/v1/notifications`    | admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin |
| `/api/v1/audit-logs`       | admin | admin | admin | admin |
| `/api/v1/activity-logs`    | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | admin | admin |
| `/api/v1/api-keys`         | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin | client, engineer, supervisor, supplier, admin |
| `/api/v1/system-settings`  | admin | admin | admin | admin |
| `/api/v1/email-templates`  | admin | admin | admin | admin |

### Full Model API Methods

| Method | Endpoint | Roles | Controller action |
| ------ | -------- | ----- | ----------------- |
| `POST` | `/api/v1/users` | admin | `createUser` |
| `GET` | `/api/v1/users` | admin | `getUsers` |
| `GET` | `/api/v1/users/:id` | admin | `getUserById` |
| `PUT` | `/api/v1/users/:id` | admin | `updateUser` |
| `DELETE` | `/api/v1/users/:id` | admin | `deleteUser` |
| `POST` | `/api/v1/sessions` | admin | `createSession` |
| `GET` | `/api/v1/sessions` | admin | `getSessions` |
| `GET` | `/api/v1/sessions/:id` | admin | `getSessionById` |
| `PUT` | `/api/v1/sessions/:id` | admin | `updateSession` |
| `DELETE` | `/api/v1/sessions/:id` | admin | `deleteSession` |
| `POST` | `/api/v1/accounts` | admin | `createAccount` |
| `GET` | `/api/v1/accounts` | admin | `getAccounts` |
| `GET` | `/api/v1/accounts/:id` | admin | `getAccountById` |
| `PUT` | `/api/v1/accounts/:id` | admin | `updateAccount` |
| `DELETE` | `/api/v1/accounts/:id` | admin | `deleteAccount` |
| `POST` | `/api/v1/verifications` | admin | `createVerification` |
| `GET` | `/api/v1/verifications` | admin | `getVerifications` |
| `GET` | `/api/v1/verifications/:id` | admin | `getVerificationById` |
| `PUT` | `/api/v1/verifications/:id` | admin | `updateVerification` |
| `DELETE` | `/api/v1/verifications/:id` | admin | `deleteVerification` |
| `POST` | `/api/v1/projects` | client | `createProject` |
| `GET` | `/api/v1/projects` | client, engineer, supervisor, supplier, admin | `getProjects` |
| `GET` | `/api/v1/projects/:id` | client, engineer, supervisor, supplier, admin | `getProjectById` |
| `PUT` | `/api/v1/projects/:id` | client, engineer, admin | `updateProject` |
| `DELETE` | `/api/v1/projects/:id` | client, admin | `deleteProject` |
| `POST` | `/api/v1/project-members` | client, engineer, admin | `createProjectMember` |
| `GET` | `/api/v1/project-members` | client, engineer, supervisor, supplier, admin | `getProjectMembers` |
| `GET` | `/api/v1/project-members/:id` | client, engineer, supervisor, supplier, admin | `getProjectMemberById` |
| `PUT` | `/api/v1/project-members/:id` | client, engineer, supervisor, supplier, admin | `updateProjectMember` |
| `DELETE` | `/api/v1/project-members/:id` | client, engineer, admin | `deleteProjectMember` |
| `POST` | `/api/v1/escrow-accounts` | admin | `createEscrowAccount` |
| `GET` | `/api/v1/escrow-accounts` | client, engineer, admin | `getEscrowAccounts` |
| `GET` | `/api/v1/escrow-accounts/:id` | client, engineer, admin | `getEscrowAccountById` |
| `PUT` | `/api/v1/escrow-accounts/:id` | admin | `updateEscrowAccount` |
| `DELETE` | `/api/v1/escrow-accounts/:id` | admin | `deleteEscrowAccount` |
| `POST` | `/api/v1/transactions` | client, admin | `createTransaction` |
| `GET` | `/api/v1/transactions` | client, engineer, admin | `getTransactions` |
| `GET` | `/api/v1/transactions/:id` | client, engineer, admin | `getTransactionById` |
| `PUT` | `/api/v1/transactions/:id` | admin | `updateTransaction` |
| `DELETE` | `/api/v1/transactions/:id` | admin | `deleteTransaction` |
| `POST` | `/api/v1/milestones` | engineer, admin | `createMilestone` |
| `GET` | `/api/v1/milestones` | client, engineer, supervisor, admin | `getMilestones` |
| `GET` | `/api/v1/milestones/:id` | client, engineer, supervisor, admin | `getMilestoneById` |
| `PUT` | `/api/v1/milestones/:id` | engineer, supervisor, admin | `updateMilestone` |
| `DELETE` | `/api/v1/milestones/:id` | engineer, admin | `deleteMilestone` |
| `POST` | `/api/v1/boq-items` | engineer, admin | `createBoqItem` |
| `GET` | `/api/v1/boq-items` | client, engineer, supervisor, supplier, admin | `getBoqItems` |
| `GET` | `/api/v1/boq-items/:id` | client, engineer, supervisor, supplier, admin | `getBoqItemById` |
| `PUT` | `/api/v1/boq-items/:id` | engineer, admin | `updateBoqItem` |
| `DELETE` | `/api/v1/boq-items/:id` | engineer, admin | `deleteBoqItem` |
| `POST` | `/api/v1/rfqs` | engineer, admin | `createRfq` |
| `GET` | `/api/v1/rfqs` | engineer, supplier, admin | `getRfqs` |
| `GET` | `/api/v1/rfqs/:id` | engineer, supplier, admin | `getRfqById` |
| `PUT` | `/api/v1/rfqs/:id` | engineer, admin | `updateRfq` |
| `DELETE` | `/api/v1/rfqs/:id` | engineer, admin | `deleteRfq` |
| `POST` | `/api/v1/quotes` | supplier | `createQuote` |
| `GET` | `/api/v1/quotes` | engineer, supplier, admin | `getQuotes` |
| `GET` | `/api/v1/quotes/:id` | engineer, supplier, admin | `getQuoteById` |
| `PUT` | `/api/v1/quotes/:id` | supplier, engineer, admin | `updateQuote` |
| `DELETE` | `/api/v1/quotes/:id` | supplier, admin | `deleteQuote` |
| `POST` | `/api/v1/purchase-orders` | engineer, admin | `createPurchaseOrder` |
| `GET` | `/api/v1/purchase-orders` | engineer, supplier, admin | `getPurchaseOrders` |
| `GET` | `/api/v1/purchase-orders/:id` | engineer, supplier, admin | `getPurchaseOrderById` |
| `PUT` | `/api/v1/purchase-orders/:id` | supplier, engineer, admin | `updatePurchaseOrder` |
| `DELETE` | `/api/v1/purchase-orders/:id` | admin | `deletePurchaseOrder` |
| `POST` | `/api/v1/deliveries` | supplier | `createDelivery` |
| `GET` | `/api/v1/deliveries` | client, engineer, supplier, admin | `getDeliverys` |
| `GET` | `/api/v1/deliveries/:id` | client, engineer, supplier, admin | `getDeliveryById` |
| `PUT` | `/api/v1/deliveries/:id` | supplier, engineer, client, admin | `updateDelivery` |
| `DELETE` | `/api/v1/deliveries/:id` | supplier, admin | `deleteDelivery` |
| `POST` | `/api/v1/progress-photos` | engineer, supervisor, admin | `createProgressPhoto` |
| `GET` | `/api/v1/progress-photos` | client, engineer, supervisor, admin | `getProgressPhotos` |
| `GET` | `/api/v1/progress-photos/:id` | client, engineer, supervisor, admin | `getProgressPhotoById` |
| `PUT` | `/api/v1/progress-photos/:id` | engineer, supervisor, admin | `updateProgressPhoto` |
| `DELETE` | `/api/v1/progress-photos/:id` | engineer, supervisor, admin | `deleteProgressPhoto` |
| `POST` | `/api/v1/inspections` | supervisor, admin | `createInspection` |
| `GET` | `/api/v1/inspections` | client, engineer, supervisor, admin | `getInspections` |
| `GET` | `/api/v1/inspections/:id` | client, engineer, supervisor, admin | `getInspectionById` |
| `PUT` | `/api/v1/inspections/:id` | supervisor, admin | `updateInspection` |
| `DELETE` | `/api/v1/inspections/:id` | supervisor, admin | `deleteInspection` |
| `POST` | `/api/v1/disputes` | client, engineer, supplier | `createDispute` |
| `GET` | `/api/v1/disputes` | client, engineer, supplier, admin | `getDisputes` |
| `GET` | `/api/v1/disputes/:id` | client, engineer, supplier, admin | `getDisputeById` |
| `PUT` | `/api/v1/disputes/:id` | admin | `updateDispute` |
| `DELETE` | `/api/v1/disputes/:id` | admin | `deleteDispute` |
| `POST` | `/api/v1/dispute-evidence` | client, engineer, supplier | `createDisputeEvidence` |
| `GET` | `/api/v1/dispute-evidence` | client, engineer, supplier, admin | `getDisputeEvidences` |
| `GET` | `/api/v1/dispute-evidence/:id` | client, engineer, supplier, admin | `getDisputeEvidenceById` |
| `PUT` | `/api/v1/dispute-evidence/:id` | client, engineer, supplier, admin | `updateDisputeEvidence` |
| `DELETE` | `/api/v1/dispute-evidence/:id` | client, engineer, supplier, admin | `deleteDisputeEvidence` |
| `POST` | `/api/v1/messages` | client, engineer, supervisor, supplier, admin | `createMessage` |
| `GET` | `/api/v1/messages` | client, engineer, supervisor, supplier, admin | `getMessages` |
| `GET` | `/api/v1/messages/:id` | client, engineer, supervisor, supplier, admin | `getMessageById` |
| `PUT` | `/api/v1/messages/:id` | client, engineer, supervisor, supplier, admin | `updateMessage` |
| `DELETE` | `/api/v1/messages/:id` | client, engineer, supervisor, supplier, admin | `deleteMessage` |
| `POST` | `/api/v1/notifications` | admin | `createNotification` |
| `GET` | `/api/v1/notifications` | client, engineer, supervisor, supplier, admin | `getNotifications` |
| `GET` | `/api/v1/notifications/:id` | client, engineer, supervisor, supplier, admin | `getNotificationById` |
| `PUT` | `/api/v1/notifications/:id` | client, engineer, supervisor, supplier, admin | `updateNotification` |
| `DELETE` | `/api/v1/notifications/:id` | client, engineer, supervisor, supplier, admin | `deleteNotification` |
| `POST` | `/api/v1/audit-logs` | admin | `createAuditLog` |
| `GET` | `/api/v1/audit-logs` | admin | `getAuditLogs` |
| `GET` | `/api/v1/audit-logs/:id` | admin | `getAuditLogById` |
| `PUT` | `/api/v1/audit-logs/:id` | admin | `updateAuditLog` |
| `DELETE` | `/api/v1/audit-logs/:id` | admin | `deleteAuditLog` |
| `POST` | `/api/v1/activity-logs` | client, engineer, supervisor, supplier, admin | `createActivityLog` |
| `GET` | `/api/v1/activity-logs` | client, engineer, supervisor, supplier, admin | `getActivityLogs` |
| `GET` | `/api/v1/activity-logs/:id` | client, engineer, supervisor, supplier, admin | `getActivityLogById` |
| `PUT` | `/api/v1/activity-logs/:id` | admin | `updateActivityLog` |
| `DELETE` | `/api/v1/activity-logs/:id` | admin | `deleteActivityLog` |
| `POST` | `/api/v1/api-keys` | client, engineer, supervisor, supplier, admin | `createApiKey` |
| `GET` | `/api/v1/api-keys` | client, engineer, supervisor, supplier, admin | `getApiKeys` |
| `GET` | `/api/v1/api-keys/:id` | client, engineer, supervisor, supplier, admin | `getApiKeyById` |
| `PUT` | `/api/v1/api-keys/:id` | client, engineer, supervisor, supplier, admin | `updateApiKey` |
| `DELETE` | `/api/v1/api-keys/:id` | client, engineer, supervisor, supplier, admin | `deleteApiKey` |
| `POST` | `/api/v1/system-settings` | admin | `createSystemSetting` |
| `GET` | `/api/v1/system-settings` | admin | `getSystemSettings` |
| `GET` | `/api/v1/system-settings/:id` | admin | `getSystemSettingById` |
| `PUT` | `/api/v1/system-settings/:id` | admin | `updateSystemSetting` |
| `DELETE` | `/api/v1/system-settings/:id` | admin | `deleteSystemSetting` |
| `POST` | `/api/v1/email-templates` | admin | `createEmailTemplate` |
| `GET` | `/api/v1/email-templates` | admin | `getEmailTemplates` |
| `GET` | `/api/v1/email-templates/:id` | admin | `getEmailTemplateById` |
| `PUT` | `/api/v1/email-templates/:id` | admin | `updateEmailTemplate` |
| `DELETE` | `/api/v1/email-templates/:id` | admin | `deleteEmailTemplate` |

## Better Auth Routes

Core routes:

| Method         | Route                               | Description                      |
| -------------- | ----------------------------------- | -------------------------------- |
| `GET`          | `/api/v1/auth/ok`                      | Check Better Auth status         |
| `POST`         | `/api/v1/auth/sign-up/email`           | Sign up with email and password  |
| `POST`         | `/api/v1/auth/sign-in/email`           | Sign in with email and password  |
| `POST`         | `/api/v1/auth/sign-in/social`          | Start social sign-in flow        |
| `GET`          | `/api/v1/auth/callback/:id`            | OAuth callback route             |
| `POST`         | `/api/v1/auth/sign-out`                | Sign out current user            |
| `GET` / `POST` | `/api/v1/auth/get-session`             | Get the current session          |
| `GET`          | `/api/v1/auth/list-sessions`           | List current user sessions       |
| `POST`         | `/api/v1/auth/revoke-session`          | Revoke one session               |
| `POST`         | `/api/v1/auth/revoke-sessions`         | Revoke all current user sessions |
| `POST`         | `/api/v1/auth/revoke-other-sessions`   | Revoke other sessions            |
| `POST`         | `/api/v1/auth/update-session`          | Update current session data      |
| `POST`         | `/api/v1/auth/update-user`             | Update current user              |
| `POST`         | `/api/v1/auth/change-password`         | Change current user password     |
| `POST`         | `/api/v1/auth/change-email`            | Change current user email        |
| `POST`         | `/api/v1/auth/delete-user`             | Request or delete current user   |
| `GET`          | `/api/v1/auth/delete-user/callback`    | Delete user callback route       |
| `POST`         | `/api/v1/auth/request-password-reset`  | Request password reset email     |
| `GET`          | `/api/v1/auth/reset-password/:token`   | Password reset callback route    |
| `POST`         | `/api/v1/auth/reset-password`          | Reset password                   |
| `POST`         | `/api/v1/auth/verify-password`         | Verify current password          |
| `POST`         | `/api/v1/auth/send-verification-email` | Send verification email          |
| `GET`          | `/api/v1/auth/verify-email`            | Verify email address             |
| `GET`          | `/api/v1/auth/list-accounts`           | List linked accounts             |
| `POST`         | `/api/v1/auth/link-social`             | Link a social account            |
| `POST`         | `/api/v1/auth/unlink-account`          | Unlink an account                |
| `GET`          | `/api/v1/auth/get-access-token`        | Get account access token         |
| `POST`         | `/api/v1/auth/refresh-token`           | Refresh account token            |
| `GET`          | `/api/v1/auth/account-info`            | Get linked account info          |
| `GET`          | `/api/v1/auth/error`                   | Better Auth error route          |

Username plugin routes:

| Method | Route                             | Description                        |
| ------ | --------------------------------- | ---------------------------------- |
| `POST` | `/api/v1/auth/sign-in/username`      | Sign in with username and password |
| `POST` | `/api/v1/auth/is-username-available` | Check username availability        |

Phone number plugin routes:

| Method | Route                                           | Description                            |
| ------ | ----------------------------------------------- | -------------------------------------- |
| `POST` | `/api/v1/auth/sign-in/phone-number`                | Sign in with phone number and password |
| `POST` | `/api/v1/auth/phone-number/send-otp`               | Send phone verification OTP            |
| `POST` | `/api/v1/auth/phone-number/verify`                 | Verify phone number OTP                |
| `POST` | `/api/v1/auth/phone-number/request-password-reset` | Request phone password reset           |
| `POST` | `/api/v1/auth/phone-number/reset-password`         | Reset password with phone OTP          |

Admin plugin routes:

| Method | Route                                  | Description                    |
| ------ | -------------------------------------- | ------------------------------ |
| `POST` | `/api/v1/auth/admin/set-role`             | Set a user's role              |
| `GET`  | `/api/v1/auth/admin/get-user`             | Get one user                   |
| `POST` | `/api/v1/auth/admin/create-user`          | Create a user                  |
| `POST` | `/api/v1/auth/admin/update-user`          | Update a user                  |
| `GET`  | `/api/v1/auth/admin/list-users`           | List users                     |
| `POST` | `/api/v1/auth/admin/list-user-sessions`   | List sessions for a user       |
| `POST` | `/api/v1/auth/admin/ban-user`             | Ban a user                     |
| `POST` | `/api/v1/auth/admin/unban-user`           | Unban a user                   |
| `POST` | `/api/v1/auth/admin/impersonate-user`     | Impersonate a user             |
| `POST` | `/api/v1/auth/admin/stop-impersonating`   | Stop impersonating             |
| `POST` | `/api/v1/auth/admin/revoke-user-session`  | Revoke one user session        |
| `POST` | `/api/v1/auth/admin/revoke-user-sessions` | Revoke all sessions for a user |
| `POST` | `/api/v1/auth/admin/remove-user`          | Remove a user                  |
| `POST` | `/api/v1/auth/admin/set-user-password`    | Set a user's password          |
| `POST` | `/api/v1/auth/admin/has-permission`       | Check admin permissions        |

## KYC Routes

| Method | Route                  | Roles | Description             |
| ------ | ---------------------- | ----- | ----------------------- |
| `POST` | `/api/v1/kyc/documents`   | authenticated user | Upload KYC document |
| `GET`  | `/api/v1/kyc/status`      | authenticated user | Get current user KYC status |
| `GET`  | `/api/v1/kyc/pending`     | admin | Get pending KYC submissions |
| `POST` | `/api/v1/kyc/:userId/approve` | admin | Approve a user's KYC |
| `POST` | `/api/v1/kyc/:userId/reject`  | admin | Reject a user's KYC |

## Project Structure

```text
src/
  app.ts                         Express app entry point
  api/
    v1/
      index.ts                   Versioned API v1 route registry
      docs/
        openapi.ts               OpenAPI route definitions
        swagger.route.ts         Swagger UI and JSON routes
      controllers/
        account.controller.ts
        activity-log.controller.ts
        api-key.controller.ts
        audit-log.controller.ts
        boq-item.controller.ts
        delivery.controller.ts
        dispute-evidence.controller.ts
        dispute.controller.ts
        email-template.controller.ts
        escrow-account.controller.ts
        inspection.controller.ts
        kyc.controller.ts
        message.controller.ts
        milestone.controller.ts
        notification.controller.ts
        progress-photo.controller.ts
        project-member.controller.ts
        project.controller.ts
        purchase-order.controller.ts
        quote.controller.ts
        rfq.controller.ts
        session.controller.ts
        system-setting.controller.ts
        transaction.controller.ts
        user.controller.ts
        verification.controller.ts
      middleware/
        auth.middleware.ts       Auth middleware
        role.middleware.ts       Role middleware
        upload.middleware.ts     Upload middleware
      routes/
        account.route.ts
        activity-log.route.ts
        api-key.route.ts
        audit-log.route.ts
        boq-item.route.ts
        delivery.route.ts
        dispute-evidence.route.ts
        dispute.route.ts
        email-template.route.ts
        escrow-account.route.ts
        inspection.route.ts
        kyc.route.ts
        message.route.ts
        milestone.route.ts
        notification.route.ts
        progress-photo.route.ts
        project-member.route.ts
        project.route.ts
        purchase-order.route.ts
        quote.route.ts
        rfq.route.ts
        session.route.ts
        system-setting.route.ts
        transaction.route.ts
        user.route.ts
        verification.route.ts
  lib/
    africatalking.ts             Africa's Talking SMS client
    auth.ts                      Better Auth configuration
    cloudinary.ts                Cloudinary configuration
    prisma.ts                    Prisma client setup
    resend.ts                    Resend email client
  types/
    express.d.ts                 Express type extensions
  utils/
    email-tempelates.ts          Email templates
prisma/
  schema.prisma                  Database schema
prisma.config.ts                 Prisma config
```

## Database Models

The current Prisma schema contains:

- `User`
- `Session`
- `Account`
- `Verification`
- `KycDocument`
- `Project`
- `ProjectMember`
- `EscrowAccount`
- `Transaction`
- `Milestone`
- `BoqItem`
- `Rfq`
- `Quote`
- `PurchaseOrder`
- `Delivery`
- `ProgressPhoto`
- `Inspection`
- `Dispute`
- `DisputeEvidence`
- `Message`
- `Notification`
- `AuditLog`
- `ActivityLog`
- `ApiKey`
- `SystemSetting`
- `EmailTemplate`

## Roles

The API currently supports these roles:

- `admin`
- `client`
- `engineer`
- `supervisor`
- `supplier`

## Notes

- Make sure `DATABASE_URL` points to the Prisma PostgreSQL database before running Prisma commands.
- The API supports web and Expo/mobile development origins through `FRONTEND_URL`, `MOBILE_URL`, and `CORS_ORIGINS`.
- Cloudinary environment variables are required when using upload functionality.
- Resend is used for email sending.
- Africa's Talking is used for SMS sending.

## Full Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum KycStatus {
  not_submitted
  submitted
  under_review
  additional_info_requested
  approved
  rejected
}

enum KycDocumentType {
  national_id
  passport
  ier_license
  indemnity_insurance
  business_registration
  tax_compliance
  certification
}

enum KycDocumentStatus {
  pending
  approved
  rejected
}

enum ProjectStatus {
  draft
  active
  paused
  completed
  terminated
}

enum MilestoneStatus {
  pending
  active
  pending_supervisor
  revision_required
  awaiting_client_payment
  paid
}

enum InspectionDecision {
  approved
  revision_required
}

enum RfqStatus {
  open
  closed
  cancelled
}

enum QuoteStatus {
  pending_selection
  selected
  rejected
}

enum PurchaseOrderStatus {
  issued
  accepted
  shipped
  completed
}

enum DeliveryStatus {
  preparing
  in_transit
  delivered
  pending_confirmation
  confirmed
  rejected
}

enum TransactionType {
  deposit
  release
  refund
  freeze
  unfreeze
  auto_payment
  penalty
}

enum TransactionStatus {
  pending
  completed
  failed
  reversed
}

enum PaymentMethod {
  mtn_momo
  airtel_money
  bank_transfer
}

enum DisputeStatus {
  open
  under_review
  resolved_full_payment
  resolved_partial
  resolved_refund
  resolved_termination
  closed
}

enum DisputeCategory {
  quality
  timeline
  cost
  other
}

enum NotificationChannel {
  push
  email
  sms
  in_app
}

enum NotificationStatus {
  pending
  sent
  delivered
  failed
  read
}

enum AssignmentStatus {
  pending
  accepted
  declined
  removed
}

model User {
  id                  String    @id
  name                String
  email               String    @unique
  emailVerified       Boolean   @default(false)
  image               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  role                String    @default("client")
  banned              Boolean?  @default(false)
  banReason           String?
  banExpires          DateTime?
  username            String?   @unique
  displayUsername     String?
  phoneNumber         String?   @unique
  phoneNumberVerified Boolean?
  fcmToken            String?
  kycStatus           KycStatus @default(not_submitted)
  kycSubmittedAt      DateTime?
  kycReviewedAt       DateTime?
  kycRejectionReason  String?
  lastLoginAt         DateTime?
  notificationPrefs   Json      @default("{}")

  sessions             Session[]
  accounts             Account[]
  kycDocuments         KycDocument[]
  clientProjects       Project[]             @relation("ClientProjects")
  engineerProjects     Project[]             @relation("EngineerProjects")
  projectMembers       ProjectMember[]
  milestonesCreated    Milestone[]
  rfqsCreated          Rfq[]
  quotesSubmitted      Quote[]
  purchaseOrders       PurchaseOrder[]
  deliveries           Delivery[]
  progressPhotos       ProgressPhoto[]
  inspections          Inspection[]
  disputesRaised       Dispute[]             @relation("DisputeRaisedBy")
  disputeEvidence      DisputeEvidence[]
  transactions         Transaction[]
  notifications        Notification[]
  sentMessages         Message[]
  auditLogs            AuditLog[]
  activityLogs         ActivityLog[]
  apiKeys              ApiKey[]
  @@index([role])
  @@index([kycStatus])
  @@map("user")
}

model Session {
  id             String   @id
  expiresAt      DateTime
  token          String   @unique
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  ipAddress      String?
  userAgent      String?
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  impersonatedBy String?

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

model KycDocument {
  id            String            @id @default(cuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          KycDocumentType
  cloudinaryUrl String
  publicId      String
  status        KycDocumentStatus @default(pending)
  reviewNote    String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@unique([userId, type])
  @@index([userId])
  @@map("kyc_document")
}

model Project {
  id                 String        @id @default(cuid())
  name               String
  description        String?
  status             ProjectStatus @default(draft)
  budget             Decimal       @db.Decimal(15, 2)
  currency           String        @default("RWF")
  address            String?
  gpsBoundary        Json?
  sitePhotos         Json          @default("[]")
  architecturalPlans Json          @default("[]")
  startDate          DateTime?
  endDate            DateTime?
  clientId           String
  client             User          @relation("ClientProjects", fields: [clientId], references: [id])
  engineerId         String?
  engineer           User?         @relation("EngineerProjects", fields: [engineerId], references: [id])
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  milestones    Milestone[]
  escrowAccount EscrowAccount?
  projectMembers ProjectMember[]
  rfqs          Rfq[]
  progressPhotos ProgressPhoto[]
  disputes      Dispute[]
  messages      Message[]
  auditLogs     AuditLog[]

  @@index([clientId])
  @@index([engineerId])
  @@index([status])
  @@map("project")
}

model ProjectMember {
  id          String           @id @default(cuid())
  projectId   String
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  role        String
  status      AssignmentStatus @default(pending)
  invitedAt   DateTime         @default(now())
  acceptedAt  DateTime?
  removedAt   DateTime?

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
  @@index([status])
  @@map("project_member")
}

model EscrowAccount {
  id            String    @id @default(cuid())
  projectId     String    @unique
  project       Project   @relation(fields: [projectId], references: [id])
  balance       Decimal   @default(0) @db.Decimal(15, 2)
  lockedBalance Decimal   @default(0) @db.Decimal(15, 2)
  currency      String    @default("RWF")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  transactions Transaction[]

  @@map("escrow_account")
}

model Transaction {
  id              String            @id @default(cuid())
  escrowAccountId String
  escrowAccount   EscrowAccount     @relation(fields: [escrowAccountId], references: [id])
  milestoneId     String?
  milestone       Milestone?        @relation(fields: [milestoneId], references: [id])
  actorId         String
  actor           User              @relation(fields: [actorId], references: [id])
  type            TransactionType
  method          PaymentMethod?
  amount          Decimal           @db.Decimal(15, 2)
  status          TransactionStatus @default(pending)
  reference       String?
  metadata        Json?
  completedAt     DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([escrowAccountId])
  @@index([milestoneId])
  @@index([actorId])
  @@index([status])
  @@map("transaction")
}

model Milestone {
  id                 String          @id @default(cuid())
  projectId          String
  project            Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  engineerId         String
  engineer           User            @relation(fields: [engineerId], references: [id])
  name               String
  description        String?
  budgetPercentage   Decimal         @db.Decimal(5, 2)
  durationDays       Int?
  acceptanceCriteria String?
  dependsOn          String?
  order              Int
  status             MilestoneStatus @default(pending)
  completedAt        DateTime?
  paidAt             DateTime?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  boqItems       BoqItem[]
  inspections    Inspection[]
  rfqs           Rfq[]
  transactions   Transaction[]
  progressPhotos ProgressPhoto[]
  disputes       Dispute[]

  @@index([projectId])
  @@index([engineerId])
  @@index([status])
  @@map("milestone")
}

model BoqItem {
  id          String    @id @default(cuid())
  milestoneId String
  milestone   Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  category    String
  name        String
  quantity    Decimal   @db.Decimal(10, 2)
  unit        String
  unitPrice   Decimal   @db.Decimal(15, 2)
  totalPrice  Decimal   @db.Decimal(15, 2)
  actualCost  Decimal?  @db.Decimal(15, 2)
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([milestoneId])
  @@map("boq_item")
}

model Rfq {
  id              String    @id @default(cuid())
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id])
  milestoneId     String
  milestone       Milestone @relation(fields: [milestoneId], references: [id])
  engineerId      String
  engineer        User      @relation(fields: [engineerId], references: [id])
  title           String
  specs           Json      @default("{}")
  quantity        Decimal   @db.Decimal(10, 2)
  unit            String
  deadline        DateTime
  status          RfqStatus @default(open)
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  quotes        Quote[]
  purchaseOrder PurchaseOrder?

  @@index([projectId])
  @@index([milestoneId])
  @@index([status])
  @@map("rfq")
}

model Quote {
  id             String      @id @default(cuid())
  rfqId          String
  rfq            Rfq         @relation(fields: [rfqId], references: [id])
  supplierId     String
  supplier       User        @relation(fields: [supplierId], references: [id])
  unitPrice      Decimal     @db.Decimal(15, 2)
  totalPrice     Decimal     @db.Decimal(15, 2)
  deliveryDays   Int
  warrantyMonths Int?
  terms          String?
  certUrls       Json        @default("[]")
  status         QuoteStatus @default(pending_selection)
  selectedAt     DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  purchaseOrder PurchaseOrder?

  @@index([rfqId])
  @@index([supplierId])
  @@index([status])
  @@map("quote")
}

model PurchaseOrder {
  id          String              @id @default(cuid())
  rfqId       String              @unique
  rfq         Rfq                 @relation(fields: [rfqId], references: [id])
  quoteId     String              @unique
  quote       Quote               @relation(fields: [quoteId], references: [id])
  supplierId  String
  supplier    User                @relation(fields: [supplierId], references: [id])
  poNumber    String              @unique
  cloudinaryUrl String
  status      PurchaseOrderStatus @default(issued)
  issuedAt    DateTime            @default(now())
  acceptedAt  DateTime?
  completedAt DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  deliveries Delivery[]

  @@index([supplierId])
  @@index([status])
  @@map("purchase_order")
}

model Delivery {
  id              String         @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id])
  supplierId      String
  supplier        User           @relation(fields: [supplierId], references: [id])
  status          DeliveryStatus @default(preparing)
  startGps        Json?
  endGps          Json?
  proofPhotos     Json           @default("[]")
  notes           String?
  rejectionReason String?
  startedAt       DateTime?
  arrivedAt       DateTime?
  confirmedAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([purchaseOrderId])
  @@index([supplierId])
  @@index([status])
  @@map("delivery")
}

model ProgressPhoto {
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id])
  milestoneId  String?
  milestone    Milestone? @relation(fields: [milestoneId], references: [id])
  uploadedById String
  uploadedBy   User      @relation(fields: [uploadedById], references: [id])
  cloudinaryUrl String
  publicId     String
  gpsLocation  Json?
  caption      String?
  isVideo      Boolean   @default(false)
  videoDuration Int?
  createdAt    DateTime  @default(now())

  @@index([projectId])
  @@index([milestoneId])
  @@index([createdAt])
  @@map("progress_photo")
}

model Inspection {
  id            String              @id @default(cuid())
  milestoneId   String
  milestone     Milestone           @relation(fields: [milestoneId], references: [id])
  supervisorId  String
  supervisor    User                @relation(fields: [supervisorId], references: [id])
  checklist     Json                @default("{}")
  photos        Json                @default("[]")
  rating        Int?
  signatureUrl  String?
  notes         String?
  decision      InspectionDecision?
  attemptNumber Int                 @default(1)
  signedAt      DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([milestoneId])
  @@index([supervisorId])
  @@map("inspection")
}

model Dispute {
  id               String          @id @default(cuid())
  projectId        String
  project          Project         @relation(fields: [projectId], references: [id])
  milestoneId      String?
  milestone        Milestone?      @relation(fields: [milestoneId], references: [id])
  raisedById       String
  raisedBy         User            @relation("DisputeRaisedBy", fields: [raisedById], references: [id])
  category         DisputeCategory
  description      String
  status           DisputeStatus   @default(open)
  amountInDispute  Decimal         @db.Decimal(15, 2)
  resolution       Json?
  resolvedAt       DateTime?
  resolvedBy       String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  evidence DisputeEvidence[]

  @@index([projectId])
  @@index([milestoneId])
  @@index([status])
  @@map("dispute")
}

model DisputeEvidence {
  id            String   @id @default(cuid())
  disputeId     String
  dispute       Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)
  uploadedById  String
  uploadedBy    User     @relation(fields: [uploadedById], references: [id])
  cloudinaryUrl String
  description   String?
  createdAt     DateTime @default(now())

  @@index([disputeId])
  @@map("dispute_evidence")
}

model Message {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  senderId  String
  sender    User     @relation(fields: [senderId], references: [id])
  content   String
  photoUrl  String?
  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([senderId])
  @@map("message")
}

model Notification {
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel       NotificationChannel
  title         String
  body          String
  data          Json                @default("{}")
  status        NotificationStatus  @default(pending)
  sentAt        DateTime?
  deliveredAt   DateTime?
  readAt        DateTime?
  failureReason String?
  createdAt     DateTime            @default(now())

  @@index([userId])
  @@index([userId, status])
  @@map("notification")
}

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String?
  actor       User?    @relation(fields: [actorId], references: [id])
  action      String
  entityType  String
  entityId    String?
  oldValues   Json?
  newValues   Json?
  ipAddress   String?
  userAgent   String?
  result      String
  createdAt   DateTime @default(now())

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_log")
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action    String
  metadata  Json?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("activity_log")
}

model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  keyHash     String    @unique
  prefix      String
  permissions Json      @default("[]")
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId])
  @@map("api_key")
}

model SystemSetting {
  id          String   @id @default(cuid())
  key         String   @unique
  value       Json
  description String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("system_setting")
}

model EmailTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  subject     String
  htmlContent String
  plainText   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("email_template")
}
```
