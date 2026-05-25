"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openApiDocument = void 0;
const allRoles = ["client", "engineer", "supervisor", "supplier", "admin"];
const modelRoutes = [
    {
        base: "/users",
        tag: "Users",
        name: "User",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
        multipart: true,
    },
    {
        base: "/sessions",
        tag: "Sessions",
        name: "Session",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/accounts",
        tag: "Accounts",
        name: "Account",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/verifications",
        tag: "Verifications",
        name: "Verification",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/projects",
        tag: "Projects",
        name: "Project",
        roles: {
            create: ["client"],
            read: allRoles,
            update: ["client", "engineer", "admin"],
            delete: ["client", "admin"],
        },
        multipart: true,
    },
    {
        base: "/project-members",
        tag: "Project Members",
        name: "ProjectMember",
        roles: {
            create: ["client", "engineer", "admin"],
            read: allRoles,
            update: allRoles,
            delete: ["client", "engineer", "admin"],
        },
        query: ["projectId", "status"],
    },
    {
        base: "/escrow-accounts",
        tag: "Escrow Accounts",
        name: "EscrowAccount",
        roles: {
            create: ["admin"],
            read: ["client", "engineer", "admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/transactions",
        tag: "Transactions",
        name: "Transaction",
        roles: {
            create: ["client", "admin"],
            read: ["client", "engineer", "admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/milestones",
        tag: "Milestones",
        name: "Milestone",
        roles: {
            create: ["engineer", "admin"],
            read: ["client", "engineer", "supervisor", "admin"],
            update: ["engineer", "supervisor", "admin"],
            delete: ["engineer", "admin"],
        },
    },
    {
        base: "/boq-items",
        tag: "BOQ Items",
        name: "BoqItem",
        roles: {
            create: ["engineer", "admin"],
            read: allRoles,
            update: ["engineer", "admin"],
            delete: ["engineer", "admin"],
        },
    },
    {
        base: "/rfqs",
        tag: "RFQs",
        name: "Rfq",
        roles: {
            create: ["engineer", "admin"],
            read: ["engineer", "supplier", "admin"],
            update: ["engineer", "admin"],
            delete: ["engineer", "admin"],
        },
    },
    {
        base: "/quotes",
        tag: "Quotes",
        name: "Quote",
        roles: {
            create: ["supplier"],
            read: ["engineer", "supplier", "admin"],
            update: ["supplier", "engineer", "admin"],
            delete: ["supplier", "admin"],
        },
        multipart: true,
    },
    {
        base: "/purchase-orders",
        tag: "Purchase Orders",
        name: "PurchaseOrder",
        roles: {
            create: ["engineer", "admin"],
            read: ["engineer", "supplier", "admin"],
            update: ["supplier", "engineer", "admin"],
            delete: ["admin"],
        },
        multipart: true,
    },
    {
        base: "/deliveries",
        tag: "Deliveries",
        name: "Delivery",
        roles: {
            create: ["supplier"],
            read: ["client", "engineer", "supplier", "admin"],
            update: ["supplier", "engineer", "client", "admin"],
            delete: ["supplier", "admin"],
        },
        multipart: true,
    },
    {
        base: "/progress-photos",
        tag: "Progress Photos",
        name: "ProgressPhoto",
        roles: {
            create: ["engineer", "supervisor", "admin"],
            read: ["client", "engineer", "supervisor", "admin"],
            update: ["engineer", "supervisor", "admin"],
            delete: ["engineer", "supervisor", "admin"],
        },
        multipart: true,
    },
    {
        base: "/inspections",
        tag: "Inspections",
        name: "Inspection",
        roles: {
            create: ["supervisor", "admin"],
            read: ["client", "engineer", "supervisor", "admin"],
            update: ["supervisor", "admin"],
            delete: ["supervisor", "admin"],
        },
        multipart: true,
    },
    {
        base: "/disputes",
        tag: "Disputes",
        name: "Dispute",
        roles: {
            create: ["client", "engineer", "supplier"],
            read: ["client", "engineer", "supplier", "admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/dispute-evidence",
        tag: "Dispute Evidence",
        name: "DisputeEvidence",
        roles: {
            create: ["client", "engineer", "supplier"],
            read: ["client", "engineer", "supplier", "admin"],
            update: ["client", "engineer", "supplier", "admin"],
            delete: ["client", "engineer", "supplier", "admin"],
        },
        multipart: true,
    },
    {
        base: "/messages",
        tag: "Messages",
        name: "Message",
        roles: {
            create: allRoles,
            read: allRoles,
            update: allRoles,
            delete: allRoles,
        },
        multipart: true,
    },
    {
        base: "/notifications",
        tag: "Notifications",
        name: "Notification",
        roles: {
            create: ["admin"],
            read: allRoles,
            update: allRoles,
            delete: allRoles,
        },
    },
    {
        base: "/audit-logs",
        tag: "Audit Logs",
        name: "AuditLog",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/activity-logs",
        tag: "Activity Logs",
        name: "ActivityLog",
        roles: {
            create: allRoles,
            read: allRoles,
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/api-keys",
        tag: "API Keys",
        name: "ApiKey",
        roles: {
            create: allRoles,
            read: allRoles,
            update: allRoles,
            delete: allRoles,
        },
    },
    {
        base: "/system-settings",
        tag: "System Settings",
        name: "SystemSetting",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
    {
        base: "/email-templates",
        tag: "Email Templates",
        name: "EmailTemplate",
        roles: {
            create: ["admin"],
            read: ["admin"],
            update: ["admin"],
            delete: ["admin"],
        },
    },
];
const authRoutes = [
    ["get", "/auth/ok", "Check Better Auth status"],
    ["post", "/auth/sign-up/email", "Sign up with email and password"],
    ["post", "/auth/sign-in/email", "Sign in with email and password"],
    ["post", "/auth/sign-in/social", "Start social sign-in flow"],
    ["get", "/auth/callback/{id}", "OAuth callback route"],
    ["post", "/auth/sign-out", "Sign out current user"],
    ["get", "/auth/get-session", "Get current session"],
    ["post", "/auth/get-session", "Get current session"],
    ["get", "/auth/list-sessions", "List current user sessions"],
    ["post", "/auth/revoke-session", "Revoke one session"],
    ["post", "/auth/revoke-sessions", "Revoke all current user sessions"],
    ["post", "/auth/revoke-other-sessions", "Revoke other sessions"],
    ["post", "/auth/update-session", "Update current session data"],
    ["post", "/auth/update-user", "Update current user"],
    ["post", "/auth/change-password", "Change current user password"],
    ["post", "/auth/change-email", "Change current user email"],
    ["post", "/auth/delete-user", "Request or delete current user"],
    ["get", "/auth/delete-user/callback", "Delete user callback route"],
    ["post", "/auth/request-password-reset", "Request password reset email"],
    ["get", "/auth/reset-password/{token}", "Password reset callback route"],
    ["post", "/auth/reset-password", "Reset password"],
    ["post", "/auth/verify-password", "Verify current password"],
    ["post", "/auth/send-verification-email", "Send verification email"],
    ["get", "/auth/verify-email", "Verify email address"],
    ["get", "/auth/list-accounts", "List linked accounts"],
    ["post", "/auth/link-social", "Link a social account"],
    ["post", "/auth/unlink-account", "Unlink an account"],
    ["get", "/auth/get-access-token", "Get account access token"],
    ["post", "/auth/refresh-token", "Refresh account token"],
    ["get", "/auth/account-info", "Get linked account info"],
    ["get", "/auth/error", "Better Auth error route"],
    ["post", "/auth/sign-in/username", "Sign in with username and password"],
    ["post", "/auth/is-username-available", "Check username availability"],
    ["post", "/auth/sign-in/phone-number", "Sign in with phone number"],
    ["post", "/auth/phone-number/send-otp", "Send phone verification OTP"],
    ["post", "/auth/phone-number/verify", "Verify phone number OTP"],
    [
        "post",
        "/auth/phone-number/request-password-reset",
        "Request phone password reset",
    ],
    ["post", "/auth/phone-number/reset-password", "Reset password with OTP"],
    ["post", "/auth/admin/set-role", "Set a user's role"],
    ["get", "/auth/admin/get-user", "Get one user"],
    ["post", "/auth/admin/create-user", "Create a user"],
    ["post", "/auth/admin/update-user", "Update a user"],
    ["get", "/auth/admin/list-users", "List users"],
    ["post", "/auth/admin/list-user-sessions", "List sessions for a user"],
    ["post", "/auth/admin/ban-user", "Ban a user"],
    ["post", "/auth/admin/unban-user", "Unban a user"],
    ["post", "/auth/admin/impersonate-user", "Impersonate a user"],
    ["post", "/auth/admin/stop-impersonating", "Stop impersonating"],
    ["post", "/auth/admin/revoke-user-session", "Revoke one user session"],
    ["post", "/auth/admin/revoke-user-sessions", "Revoke all user sessions"],
    ["post", "/auth/admin/remove-user", "Remove a user"],
    ["post", "/auth/admin/set-user-password", "Set a user's password"],
    ["post", "/auth/admin/has-permission", "Check admin permissions"],
].map(([method, path, summary]) => ({
    method: method,
    path,
    tag: "Auth",
    summary,
}));
const customRoutes = [
    {
        method: "get",
        path: "/users/engineers",
        tag: "Users",
        summary: "List engineers available for project assignment",
        roles: ["client", "admin"],
    },
    {
        method: "post",
        path: "/kyc/documents",
        tag: "KYC",
        summary: "Upload a KYC document",
        roles: allRoles,
        multipart: true,
        body: { type: "national_id" },
    },
    {
        method: "get",
        path: "/kyc/status",
        tag: "KYC",
        summary: "Get current user KYC status",
        roles: allRoles,
    },
    {
        method: "get",
        path: "/kyc/pending",
        tag: "KYC",
        summary: "List pending KYC submissions",
        roles: ["admin"],
    },
    {
        method: "post",
        path: "/kyc/{userId}/approve",
        tag: "KYC",
        summary: "Approve user KYC",
        roles: ["admin"],
    },
    {
        method: "post",
        path: "/kyc/{userId}/reject",
        tag: "KYC",
        summary: "Reject user KYC",
        roles: ["admin"],
        body: { reason: "Document is not readable" },
    },
    {
        method: "patch",
        path: "/projects/{id}/status",
        tag: "Projects",
        summary: "Toggle or set project status",
        roles: ["client", "engineer", "admin"],
        body: { status: "active" },
    },
    {
        method: "patch",
        path: "/projects/{id}/images",
        tag: "Projects",
        summary: "Replace one project image by publicId",
        roles: ["client", "engineer", "admin"],
        multipart: true,
        body: { collection: "sitePhotos", publicId: "cloudinary_public_id" },
    },
    {
        method: "delete",
        path: "/projects/{id}/images",
        tag: "Projects",
        summary: "Delete one project image by publicId",
        roles: ["client", "engineer", "admin"],
        body: { collection: "sitePhotos", publicId: "cloudinary_public_id" },
    },
    {
        method: "post",
        path: "/project-members/{id}/accept",
        tag: "Project Members",
        summary: "Accept a project assignment",
        roles: ["engineer", "admin"],
    },
    {
        method: "post",
        path: "/project-members/{id}/reject",
        tag: "Project Members",
        summary: "Reject a project assignment",
        roles: ["engineer", "admin"],
    },
];
const crudRoutes = modelRoutes.flatMap((route) => [
    {
        method: "post",
        path: route.base,
        tag: route.tag,
        summary: `Create ${route.name}`,
        roles: route.roles.create,
        multipart: route.multipart,
    },
    {
        method: "get",
        path: route.base,
        tag: route.tag,
        summary: `List ${route.name} records`,
        roles: route.roles.read,
        query: route.query,
    },
    {
        method: "get",
        path: `${route.base}/{id}`,
        tag: route.tag,
        summary: `Get ${route.name} by ID`,
        roles: route.roles.read,
    },
    {
        method: "put",
        path: `${route.base}/{id}`,
        tag: route.tag,
        summary: `Update ${route.name}`,
        roles: route.roles.update,
        multipart: route.multipart,
    },
    {
        method: "delete",
        path: `${route.base}/{id}`,
        tag: route.tag,
        summary: `Delete ${route.name}`,
        roles: route.roles.delete,
    },
]);
const routes = [...authRoutes, ...customRoutes, ...crudRoutes];
const createRequestBody = (route) => {
    if (!route.multipart && !route.body && !["post", "put", "patch"].includes(route.method)) {
        return undefined;
    }
    if (route.multipart) {
        return {
            required: false,
            content: {
                "multipart/form-data": {
                    schema: {
                        type: "object",
                        additionalProperties: true,
                        properties: {
                            ...(route.body || {}),
                            files: {
                                type: "array",
                                items: {
                                    type: "string",
                                    format: "binary",
                                },
                            },
                        },
                    },
                },
            },
        };
    }
    return {
        required: false,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    additionalProperties: true,
                    example: route.body || {},
                },
            },
        },
    };
};
const createParameters = (route) => {
    const pathParams = [...route.path.matchAll(/{([^}]+)}/g)].map((match) => ({
        name: match[1],
        in: "path",
        required: true,
        schema: {
            type: "string",
        },
    }));
    const queryParams = (route.query || []).map((name) => ({
        name,
        in: "query",
        required: false,
        schema: {
            type: "string",
        },
    }));
    return [...pathParams, ...queryParams];
};
const paths = routes.reduce((result, route) => {
    var _a;
    result[_a = route.path] || (result[_a] = {});
    result[route.path][route.method] = {
        tags: [route.tag],
        summary: route.summary,
        description: route.roles ? `Allowed roles: ${route.roles.join(", ")}` : undefined,
        security: route.path.startsWith("/auth") ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: createParameters(route),
        requestBody: createRequestBody(route),
        responses: {
            200: {
                description: "Success",
            },
            201: {
                description: "Created",
            },
            400: {
                description: "Bad request",
            },
            401: {
                description: "Unauthorized",
            },
            403: {
                description: "Forbidden",
            },
            404: {
                description: "Not found",
            },
            500: {
                description: "Internal server error",
            },
        },
    };
    return result;
}, {});
exports.openApiDocument = {
    openapi: "3.0.3",
    info: {
        title: "Inkingi Construction API",
        version: "1.0.0",
        description: "Versioned REST API documentation for Inkingi Construction backend.",
    },
    servers: [
        {
            url: "https://inkindi-construction-backend.onrender.com/api/v1",
            description: "Production",
        },
        {
            url: "http://localhost:3000/api/v1",
            description: "Local development",
        },
    ],
    tags: [
        ...new Set(routes.map((route) => route.tag)),
    ].map((name) => ({ name })),
    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "better-auth.session_token",
            },
            bearerAuth: {
                type: "http",
                scheme: "bearer",
            },
        },
    },
    paths,
};
