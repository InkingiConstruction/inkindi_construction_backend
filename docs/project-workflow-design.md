# Project Workflow Backend Design

## Current Fixes Applied

- Project list cache is now scoped by authenticated user role and ID, so `/projects` cannot reuse another user's project list.
- Project and project-member mutations clear cached reads immediately.
- Supervisors and suppliers only see projects where their own `ProjectMember` row is `accepted` and matches their role.
- Pending or declined project members can no longer read project details through `/projects/:id`.
- Accepting both core assignees (`engineer` and `supervisor`) moves a draft project to `active`.

## Existing Coverage

The current backend already includes these entities:

- `User`
- `Project`
- `ProjectMember`
- `Milestone`
- `BoqItem`
- `EscrowAccount`
- `Transaction`
- `Rfq`
- `Quote`
- `PurchaseOrder`
- `Delivery`
- `ProgressPhoto`
- `Inspection`
- `Message`
- `Notification`
- `Dispute`
- `AuditLog`
- `ActivityLog`

## Missing Or Incomplete Model Concepts

Add these models or fields before production rollout:

### Project Assignment

Current `ProjectMember` works, but should be stricter:

- Replace `role String` with enum: `engineer`, `supervisor`, `supplier`, `viewer`.
- Add `declinedAt`, `declineReason`, `invitedById`.
- Add unique accepted role constraints at application level:
  - one accepted engineer per project
  - one accepted supervisor per project
- Keep `Project.engineerId` only as a denormalized convenience, or replace it with accepted project-member lookup.

### BOQ

Current `BoqItem` is tied directly to milestones. Add a BOQ aggregate:

- `Boq`
  - `id`
  - `projectId`
  - `milestoneId?`
  - `createdById`
  - `reviewedById?`
  - `status`: `draft`, `submitted_to_supervisor`, `revision_required`, `supervisor_approved`, `client_visible`, `client_approved`, `funded`, `procurement_started`, `closed`
  - `submittedAt`, `reviewedAt`, `clientApprovedAt`, `fundedAt`
  - `reviewComment`, `revisionReason`
- Move `BoqItem.milestoneId` to `boqId`, with optional `milestoneId` for scheduling.

### Approval Workflow

Use one generic review table for BOQs, milestones, progress updates, and delivery exceptions:

- `Approval`
  - `id`
  - `entityType`: `milestone`, `boq`, `progress_update`, `delivery`
  - `entityId`
  - `projectId`
  - `requestedById`
  - `reviewerId`
  - `reviewerRole`
  - `status`: `pending`, `approved`, `rejected`, `revision_required`, `cancelled`
  - `comment`
  - `decidedAt`

This avoids duplicating status history in every table and gives the app an auditable approval timeline.

### Progress Updates

Current `ProgressPhoto` should become a grouped update:

- `ProgressUpdate`
  - `id`
  - `projectId`
  - `milestoneId?`
  - `uploadedById`
  - `caption`
  - `status`: `submitted`, `approved`, `rejected`, `revision_required`
  - `supervisorId?`
  - `supervisorComment?`
  - `reviewedAt?`
- `ProgressMedia`
  - `id`
  - `progressUpdateId`
  - `cloudinaryUrl`
  - `publicId`
  - `mediaType`: `image`, `video`
  - `durationSeconds?`
  - `gpsLocation?`

Client reads approved and rejected history with supervisor comments; engineer can see all own submissions.

### Payments

Current `Transaction` and `EscrowAccount` cover part of payment. Add a payment intent concept:

- `Payment`
  - `id`
  - `projectId`
  - `boqId?`
  - `milestoneId?`
  - `clientId`
  - `amount`
  - `currency`
  - `provider`: `stripe`, `mtn_momo`, `airtel_money`, `bank_transfer`
  - `providerReference`
  - `status`: `initiated`, `requires_action`, `processing`, `paid`, `failed`, `refunded`, `cancelled`
  - `paidAt`

Use `Transaction` as ledger entries and `Payment` as the client-facing payment lifecycle.

### Material Requests And Procurement

RFQs exist, but funded BOQ procurement should start from material requests:

- `MaterialRequest`
  - `id`
  - `projectId`
  - `boqId`
  - `boqItemId`
  - `requestedById`
  - `status`: `pending_supplier`, `accepted`, `partially_fulfilled`, `fulfilled`, `cancelled`
  - `quantityRequested`
  - `quantityAccepted`
  - `neededBy`
- `MaterialRequestSupplier`
  - `id`
  - `materialRequestId`
  - `supplierId`
  - `status`: `invited`, `accepted`, `rejected`
  - `acceptedAt`

RFQs and purchase orders can then be generated from accepted material requests.

### Deliveries And Inventory

Current `Delivery` is purchase-order level. Add line-level tracking:

- `DeliveryItem`
  - `id`
  - `deliveryId`
  - `boqItemId?`
  - `materialRequestId?`
  - `name`
  - `quantityExpected`
  - `quantityDelivered`
  - `quantityAccepted`
  - `quantityRejected`
  - `condition`: `good`, `damaged`, `incorrect`, `missing`
  - `engineerNote`
- `InventoryItem`
  - `id`
  - `projectId`
  - `boqItemId?`
  - `name`
  - `unit`
  - `quantityOnHand`
  - `quantityReserved`
  - `quantityUsed`
- `InventoryMovement`
  - `id`
  - `inventoryItemId`
  - `deliveryItemId?`
  - `actorId`
  - `type`: `received`, `used`, `adjusted`, `damaged`, `returned`
  - `quantity`
  - `note`

Engineer delivery confirmation should create inventory movements atomically.

## Role-Specific Read Rules

- Client sees projects where `Project.clientId = user.id`.
- Engineer sees projects where accepted engineer membership exists, or `Project.engineerId = user.id`.
- Supervisor sees projects where accepted supervisor membership exists.
- Supplier sees material requests, RFQs, purchase orders, and deliveries assigned to them; not all project internals by default.
- Admin sees all records.

Every nested resource should enforce project access at the database query level, not after fetching unrestricted rows.

## Recommended API Surface

### Projects And Assignments

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PUT /projects/:id`
- `PATCH /projects/:id/status`
- `GET /project-members?status=pending|accepted`
- `POST /project-members`
- `POST /project-members/:id/accept`
- `POST /project-members/:id/reject`
- `DELETE /project-members/:id`

### Milestones And BOQs

- `GET /milestones?projectId=...`
- `POST /milestones`
- `PUT /milestones/:id`
- `POST /milestones/:id/submit`
- `POST /milestones/:id/review`
- `GET /boqs?projectId=...`
- `POST /boqs`
- `PUT /boqs/:id`
- `POST /boqs/:id/submit`
- `POST /boqs/:id/review`
- `POST /boqs/:id/client-approve`

### Payments And Procurement

- `POST /payments`
- `GET /payments?projectId=...`
- `POST /payments/:id/confirm-webhook`
- `GET /material-requests`
- `POST /material-requests/from-boq/:boqId`
- `POST /material-requests/:id/accept`
- `GET /rfqs`
- `POST /rfqs`
- `GET /purchase-orders`
- `PUT /purchase-orders/:id`

### Deliveries And Inventory

- `GET /deliveries`
- `POST /deliveries`
- `PUT /deliveries/:id/status`
- `POST /deliveries/:id/confirm-receipt`
- `GET /inventory?projectId=...`
- `GET /inventory-movements?projectId=...`

### Progress And Reviews

- `GET /progress-updates?projectId=...`
- `POST /progress-updates`
- `POST /progress-updates/:id/review`
- `GET /approvals?projectId=...`

### Notifications

- Trigger notifications for:
  - assignment created
  - assignment accepted/rejected
  - both assignees accepted and project activated
  - BOQ submitted/reviewed/approved/funded
  - material request created/accepted
  - delivery status changed
  - delivery confirmed with exception
  - progress submitted/reviewed

## Production Readiness Checklist

- Use enums for roles and resource statuses.
- Add database migrations instead of `db push` for production.
- Add integration tests for role visibility and assignment acceptance.
- Add optimistic concurrency or state-transition guards for approvals and payments.
- Store payment provider webhook events idempotently.
- Add audit logs for all approval, payment, assignment, and inventory mutations.
- Paginate all list endpoints.
- Add project-scoped authorization helpers shared by controllers.
- Move in-memory cache to Redis or disable caching for user-specific lists in production.
- Add notification outbox processing so API requests do not depend on push/email/SMS provider availability.
