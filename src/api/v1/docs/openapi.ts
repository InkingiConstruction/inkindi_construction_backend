type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type RouteDoc = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  roles?: string[];
  multipart?: boolean;
  body?: Record<string, unknown>;
  query?: string[];
};

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

const authRoutes: RouteDoc[] = [
  [
    "post",
    "/auth/register",
    "Register with email and password",
    {
      email: "client@example.com",
      password: "SecurePassword123!",
      name: "Jean Bosco",
      role: "client",
      phoneNumber: "+250788123456"
    }
  ],
  [
    "post",
    "/auth/login",
    "Login with email and password",
    {
      email: "client@example.com",
      password: "SecurePassword123!"
    }
  ],
  [
    "post",
    "/auth/verify-email",
    "Verify email OTP",
    {
      email: "client@example.com",
      otp: "123456"
    }
  ],
  [
    "post",
    "/auth/resend-otp",
    "Resend email OTP",
    {
      email: "client@example.com"
    }
  ],
  ["get", "/auth/me", "Get current authenticated user"],
  ["post", "/auth/logout", "Logout current user"],
].map((item) => {
  const [method, path, summary, body] = item as [string, string, string, Record<string, unknown> | undefined];
  return {
    method: method as HttpMethod,
    path,
    tag: "Auth",
    summary,
    body,
  };
});

const customRoutes: RouteDoc[] = [
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
  {
    method: "post",
    path: "/escrow-accounts/{id}/deposit-stripe",
    tag: "Escrow Accounts",
    summary: "Initialize a Stripe deposit for an escrow account",
    roles: ["client"],
    body: { amount: 5000, currency: "usd" }
  },
  {
    method: "post",
    path: "/escrow-accounts/{id}/deposit-mtn",
    tag: "Escrow Accounts",
    summary: "Initialize an MTN Momo deposit for an escrow account",
    roles: ["client"],
    body: { amount: 100000, phoneNumber: "+250788123456" }
  },
  {
    method: "post",
    path: "/escrow-accounts/webhooks/stripe",
    tag: "Escrow Accounts",
    summary: "Stripe webhook callback handler",
    roles: []
  }
];

const crudRoutes: RouteDoc[] = modelRoutes.flatMap((route) => [
  {
    method: "post" as const,
    path: route.base,
    tag: route.tag,
    summary: `Create ${route.name}`,
    roles: route.roles.create,
    multipart: route.multipart,
  },
  {
    method: "get" as const,
    path: route.base,
    tag: route.tag,
    summary: `List ${route.name} records`,
    roles: route.roles.read,
    query: route.query,
  },
  {
    method: "get" as const,
    path: `${route.base}/{id}`,
    tag: route.tag,
    summary: `Get ${route.name} by ID`,
    roles: route.roles.read,
  },
  {
    method: "put" as const,
    path: `${route.base}/{id}`,
    tag: route.tag,
    summary: `Update ${route.name}`,
    roles: route.roles.update,
    multipart: route.multipart,
  },
  {
    method: "delete" as const,
    path: `${route.base}/{id}`,
    tag: route.tag,
    summary: `Delete ${route.name}`,
    roles: route.roles.delete,
  },
]);

const routes = [...authRoutes, ...customRoutes, ...crudRoutes];

const createRequestBody = (route: RouteDoc) => {
  if (!route.multipart && !route.body && !["post", "put", "patch"].includes(route.method)) {
    return undefined;
  }

  const generateSchemaProperties = (bodyObj: Record<string, unknown> | undefined) => {
    if (!bodyObj) return undefined;
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(bodyObj)) {
      const valType = typeof value;
      if (valType === "number") {
        properties[key] = { type: "number", example: value };
      } else if (valType === "boolean") {
        properties[key] = { type: "boolean", example: value };
      } else if (Array.isArray(value)) {
        properties[key] = { type: "array", items: { type: "string" }, example: value };
      } else if (value && valType === "object") {
        properties[key] = { type: "object", example: value };
      } else {
        properties[key] = { type: "string", example: value };
      }
    }
    return properties;
  };

  if (route.multipart) {
    const customProps = generateSchemaProperties(route.body as Record<string, unknown>) || {};
    return {
      required: false,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            additionalProperties: true,
            properties: {
              ...customProps,
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
          properties: generateSchemaProperties(route.body as Record<string, unknown>),
          example: route.body || {},
        },
      },
    },
  };
};

const createParameters = (route: RouteDoc) => {
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

const paths = routes.reduce<Record<string, Record<string, unknown>>>(
  (result, route) => {
    result[route.path] ||= {};
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
  },
  {},
);

export const openApiDocument = {
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
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  },
  paths,
};
