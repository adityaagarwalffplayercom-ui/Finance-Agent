import { prisma } from "./prisma";

export const PRIVATE_USER_MODELS = [
  "User",
  "Session",
  "Account",
  "Verification",
  "Business",
  "Document",
  "BusinessChatMessage",
  "UsageEvent",
  "AuditEvent",
] as const;

export const GLOBAL_ADMIN_MODELS = [
  "TaxRule",
  "TaxSourceDocument",
  "TaxKnowledgeChunk",
  "TaxRuleSourceLink",
] as const;

export type GlobalAdminResource =
  | "tax_rules"
  | "tax_knowledge"
  | "tax_source_documents"
  | "tax_rule_source_links"
  | "privacy_check"
  | "cron_tax_rules";

const ALLOWED_GLOBAL_ADMIN_RESOURCES: GlobalAdminResource[] = [
  "tax_rules",
  "tax_knowledge",
  "tax_source_documents",
  "tax_rule_source_links",
  "privacy_check",
  "cron_tax_rules",
];

export class AdminPrivacyError extends Error {
  statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "AdminPrivacyError";
  }
}

export function isAdminPrivacyError(error: unknown) {
  return error instanceof AdminPrivacyError;
}

export function assertGlobalAdminResource(resource: GlobalAdminResource) {
  if (!ALLOWED_GLOBAL_ADMIN_RESOURCES.includes(resource)) {
    throw new AdminPrivacyError(
      `Admin resource "${resource}" is not allowed by privacy firewall.`,
    );
  }
}

function blockPrivateModel(model?: string, operation?: string): never {
  throw new AdminPrivacyError(
    [
      "Admin Privacy Firewall blocked private user-data access.",
      `Model: ${model ?? "unknown"}`,
      `Operation: ${operation ?? "unknown"}`,
      "",
      "Admin APIs may manage only global system resources such as verified tax rules and tax knowledge.",
      "Admin APIs must not read user documents, business profiles, sessions, accounts, chat history, or extracted financial data.",
    ].join("\n"),
  );
}

type AdminOperationContext = { model?: string; operation: string };

function blockPrivateModelOperations() {
  return {
    async $allOperations({ model, operation }: AdminOperationContext) {
      blockPrivateModel(model, operation);
    },
  };
}

export const adminPrisma = prisma.$extends({
  name: "AdminPrivacyFirewall",
  query: {
    user: blockPrivateModelOperations(),
    session: blockPrivateModelOperations(),
    account: blockPrivateModelOperations(),
    verification: blockPrivateModelOperations(),
    business: blockPrivateModelOperations(),
    document: blockPrivateModelOperations(),
    businessChatMessage: blockPrivateModelOperations(),
    usageEvent: blockPrivateModelOperations(),
    auditEvent: blockPrivateModelOperations(),
  },
});

export function redactSensitiveValue(value: unknown) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.length <= 6) {
      return "***";
    }

    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }

  return "***";
}

export function sanitizeAdminLog(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "authorization",
    "cookie",
    "session",
    "email",
    "content",
    "extractedData",
    "document",
  ];

  try {
    return JSON.parse(
      JSON.stringify(value, (key, currentValue) => {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
          return redactSensitiveValue(currentValue);
        }

        return currentValue;
      }),
    );
  } catch {
    return "[Unloggable object]";
  }
}

export function getPrivacyFirewallPolicy() {
  return {
    privateUserModelsBlockedForAdmin: PRIVATE_USER_MODELS,
    globalAdminModelsAllowed: GLOBAL_ADMIN_MODELS,
    allowedGlobalAdminResources: ALLOWED_GLOBAL_ADMIN_RESOURCES,
    rule: "Admin APIs can manage global tax knowledge/rules only. User-owned data must remain accessible only through user-scoped session APIs.",
  };
}