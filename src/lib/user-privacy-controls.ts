import { jsPDF } from "jspdf";
import { prisma } from "./prisma";

export type UserPrivacyExport = {
  exportedAt: string;
  privacyScope: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  business: unknown;
  documents: unknown[];
  chatMessages: unknown[];
  usageEvents: unknown[];
  auditEvents: unknown[];
  counts: {
    documents: number;
    chatMessages: number;
    usageEvents: number;
    auditEvents: number;
  };
};

function safeString(value: unknown) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value || "Not available";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Not available";
  }
}

function truncate(value: unknown, maxLength = 1200) {
  const text = safeString(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function getObjectValue<T = unknown>(value: unknown, key: string): T | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return (value as Record<string, T>)[key] ?? null;
}

function sanitizePdfText(value: unknown) {
  return safeString(value)
    .replace(/[^\x09\x0A\x0D\x20-\x7ERs. ]/g, "")
    .replace(/\r/g, "\n")
    .trim();
}

type PdfWriter = {
  doc: jsPDF;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
};

function createPdfWriter() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  doc.setProperties({
    title: "Aureli User Data Export",
    subject: "User privacy data export",
    author: "Aureli",
    creator: "Aureli Finance OS",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;

  return {
    doc,
    y: margin,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
  };
}

function addPageIfNeeded(writer: PdfWriter, neededSpace = 80) {
  if (writer.y + neededSpace > writer.pageHeight - writer.margin) {
    writer.doc.addPage();
    writer.y = writer.margin;
  }
}

function addText(
  writer: PdfWriter,
  text: string,
  options?: {
    fontSize?: number;
    fontStyle?: "normal" | "bold";
    color?: [number, number, number];
    lineGap?: number;
    maxLines?: number;
  },
) {
  const fontSize = options?.fontSize ?? 10;
  const lineGap = options?.lineGap ?? 4;
  const color = options?.color ?? [51, 65, 85];
  const fontStyle = options?.fontStyle ?? "normal";

  writer.doc.setFont("helvetica", fontStyle);
  writer.doc.setFontSize(fontSize);
  writer.doc.setTextColor(color[0], color[1], color[2]);

  const cleaned = sanitizePdfText(text);
  const lines = writer.doc.splitTextToSize(cleaned, writer.contentWidth);
  const finalLines =
    options?.maxLines && lines.length > options.maxLines
      ? [...lines.slice(0, options.maxLines), "..."]
      : lines;

  for (const line of finalLines) {
    addPageIfNeeded(writer, fontSize + lineGap + 8);
    writer.doc.text(line, writer.margin, writer.y);
    writer.y += fontSize + lineGap;
  }
}

function addTitle(writer: PdfWriter, text: string) {
  addPageIfNeeded(writer, 50);
  addText(writer, text, {
    fontSize: 24,
    fontStyle: "bold",
    color: [2, 6, 23],
    lineGap: 8,
  });
  writer.y += 8;
}

function addSection(writer: PdfWriter, title: string) {
  addPageIfNeeded(writer, 60);
  writer.y += 12;
  addText(writer, title, {
    fontSize: 15,
    fontStyle: "bold",
    color: [15, 23, 42],
    lineGap: 6,
  });
  writer.y += 2;
}

function addSmallLabel(writer: PdfWriter, text: string) {
  addText(writer, text, {
    fontSize: 8,
    fontStyle: "bold",
    color: [14, 116, 144],
    lineGap: 4,
  });
}

function addKeyValue(writer: PdfWriter, key: string, value: unknown) {
  addPageIfNeeded(writer, 36);

  writer.doc.setFont("helvetica", "bold");
  writer.doc.setFontSize(10);
  writer.doc.setTextColor(15, 23, 42);
  writer.doc.text(`${key}:`, writer.margin, writer.y);

  const keyWidth = writer.doc.getTextWidth(`${key}: `);
  writer.doc.setFont("helvetica", "normal");
  writer.doc.setTextColor(51, 65, 85);

  const text = truncate(value, 500);
  const cleaned = sanitizePdfText(text);
  const availableWidth = writer.contentWidth - keyWidth;
  const lines = writer.doc.splitTextToSize(cleaned, availableWidth);

  writer.doc.text(lines, writer.margin + keyWidth + 4, writer.y);
  writer.y += Math.max(18, lines.length * 14);
}

function addDivider(writer: PdfWriter) {
  addPageIfNeeded(writer, 24);

  writer.doc.setDrawColor(226, 232, 240);
  writer.doc.line(
    writer.margin,
    writer.y,
    writer.pageWidth - writer.margin,
    writer.y,
  );
  writer.y += 16;
}

function addBox(writer: PdfWriter, title: string, lines: string[]) {
  addPageIfNeeded(writer, 110);

  const startY = writer.y;
  const boxPadding = 12;
  const estimatedHeight = Math.max(90, 34 + lines.length * 20);

  writer.doc.setFillColor(248, 250, 252);
  writer.doc.setDrawColor(226, 232, 240);
  writer.doc.roundedRect(
    writer.margin,
    startY,
    writer.contentWidth,
    estimatedHeight,
    12,
    12,
    "FD",
  );

  writer.y = startY + boxPadding;

  addText(writer, title, {
    fontSize: 12,
    fontStyle: "bold",
    color: [15, 23, 42],
  });

  for (const line of lines) {
    addText(writer, `- ${line}`, {
      fontSize: 9,
      color: [51, 65, 85],
      maxLines: 4,
    });
  }

  writer.y = startY + estimatedHeight + 16;
}

export async function exportOwnUserData(
  userId: string,
): Promise<UserPrivacyExport> {
  const [user, business, documents, chatMessages, usageEvents, auditEvents] =
    await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.business.findUnique({
        where: {
          userId,
        },
      }),

      prisma.document.findMany({
        where: {
          userId,
        },
        orderBy: {
          uploadedAt: "desc",
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          category: true,
          status: true,
          extractedData: true,
          extractedAt: true,
          processingError: true,
          uploadedAt: true,
          reviewStatus: true,
          reviewNote: true,
          reviewedAt: true,
        },
      }),

      prisma.businessChatMessage.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      }),

      prisma.usageEvent.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.auditEvent.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    privacyScope:
      "This export contains only data owned by the logged-in user. Admin global tax knowledge is not included.",
    user: user
      ? {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      : null,
    business,
    documents,
    chatMessages,
    usageEvents,
    auditEvents,
    counts: {
      documents: documents.length,
      chatMessages: chatMessages.length,
      usageEvents: usageEvents.length,
      auditEvents: auditEvents.length,
    },
  };
}

export async function buildUserDataExportPdf(userId: string) {
  const exportData = await exportOwnUserData(userId);
  const writer = createPdfWriter();

  addSmallLabel(writer, "AURELI USER PRIVACY EXPORT");
  addTitle(writer, "Aureli User Data Export");

  addText(writer, `Generated at: ${exportData.exportedAt}`, {
    fontSize: 10,
    color: [71, 85, 105],
  });

  addText(writer, exportData.privacyScope, {
    fontSize: 10,
    color: [71, 85, 105],
  });

  addDivider(writer);

  addBox(writer, "Privacy summary", [
    "This PDF contains user-owned data only.",
    "Global platform tax rules and tax knowledge are not included.",
    "Admin-only system data is not included.",
    "This PDF is generated from the currently logged-in user session only.",
  ]);

  addSection(writer, "Account");

  if (exportData.user) {
    addKeyValue(writer, "Name", exportData.user.name);
    addKeyValue(writer, "Email", exportData.user.email);
    addKeyValue(writer, "Email verified", exportData.user.emailVerified);
    addKeyValue(writer, "Created at", exportData.user.createdAt);
    addKeyValue(writer, "Updated at", exportData.user.updatedAt);
  } else {
    addText(writer, "No user profile found.");
  }

  addSection(writer, "Business profile");

  if (exportData.business) {
    const business = exportData.business;

    addKeyValue(writer, "Business name", getObjectValue(business, "name"));
    addKeyValue(writer, "Industry", getObjectValue(business, "industry"));
    addKeyValue(
      writer,
      "Business type",
      getObjectValue(business, "businessType"),
    );
    addKeyValue(
      writer,
      "Financial year",
      getObjectValue(business, "financialYear"),
    );
    addKeyValue(writer, "Country", getObjectValue(business, "country"));
    addKeyValue(writer, "Currency", getObjectValue(business, "currency"));
  } else {
    addText(writer, "No business profile found.");
  }

  addSection(writer, "Export counts");

  addBox(writer, "Included data", [
    `Documents: ${exportData.counts.documents}`,
    `Chat messages: ${exportData.counts.chatMessages}`,
    `Usage events: ${exportData.counts.usageEvents}`,
    `Audit events: ${exportData.counts.auditEvents}`,
  ]);

  addSection(writer, "Documents");

  if (exportData.documents.length === 0) {
    addText(writer, "No documents found.");
  }

  exportData.documents.forEach((document, index) => {
    addPageIfNeeded(writer, 160);

    addText(writer, `Document ${index + 1}`, {
      fontSize: 12,
      fontStyle: "bold",
      color: [15, 23, 42],
    });

    addKeyValue(writer, "File name", getObjectValue(document, "fileName"));
    addKeyValue(writer, "Category", getObjectValue(document, "category"));
    addKeyValue(writer, "Status", getObjectValue(document, "status"));
    addKeyValue(
      writer,
      "Review status",
      getObjectValue(document, "reviewStatus"),
    );
    addKeyValue(writer, "Uploaded at", getObjectValue(document, "uploadedAt"));
    addKeyValue(writer, "Extracted at", getObjectValue(document, "extractedAt"));
    addKeyValue(writer, "File size", getObjectValue(document, "fileSize"));

    const extractedData = getObjectValue(document, "extractedData");

    if (extractedData) {
      addText(writer, "Extracted data preview:", {
        fontSize: 10,
        fontStyle: "bold",
        color: [15, 23, 42],
      });

      addText(writer, truncate(extractedData, 1300), {
        fontSize: 8,
        color: [71, 85, 105],
        maxLines: 24,
      });
    }

    addDivider(writer);
  });

  addSection(writer, "Chat messages");

  if (exportData.chatMessages.length === 0) {
    addText(writer, "No chat messages found.");
  }

  exportData.chatMessages.slice(0, 80).forEach((message, index) => {
    addPageIfNeeded(writer, 100);

    const role = getObjectValue(message, "role");
    const content = getObjectValue(message, "content");
    const createdAt = getObjectValue(message, "createdAt");

    addText(writer, `Message ${index + 1} - ${safeString(role)}`, {
      fontSize: 11,
      fontStyle: "bold",
      color: [15, 23, 42],
    });

    addText(writer, `Created at: ${safeString(createdAt)}`, {
      fontSize: 8,
      color: [100, 116, 139],
    });

    addText(writer, truncate(content, 900), {
      fontSize: 9,
      color: [51, 65, 85],
      maxLines: 12,
    });

    writer.y += 8;
  });

  if (exportData.chatMessages.length > 80) {
    addText(
      writer,
      `Only first 80 chat messages are shown in the PDF. Total messages: ${exportData.chatMessages.length}.`,
      {
        fontSize: 9,
        color: [100, 116, 139],
      },
    );
  }

  addSection(writer, "Audit events");

  if (exportData.auditEvents.length === 0) {
    addText(writer, "No audit events found.");
  }

  exportData.auditEvents.slice(0, 80).forEach((event, index) => {
    addPageIfNeeded(writer, 90);

    addText(writer, `Audit event ${index + 1}`, {
      fontSize: 11,
      fontStyle: "bold",
      color: [15, 23, 42],
    });

    addText(writer, truncate(event, 800), {
      fontSize: 8,
      color: [71, 85, 105],
      maxLines: 12,
    });

    writer.y += 8;
  });

  addDivider(writer);

  addText(
    writer,
    "End of Aureli PDF export. For full machine-readable data, use JSON export if enabled.",
    {
      fontSize: 9,
      color: [100, 116, 139],
    },
  );

  const arrayBuffer = writer.doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export async function deleteOwnBusinessData(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [chatMessages, auditEvents, usageEvents, documents, business] =
      await Promise.all([
        tx.businessChatMessage.deleteMany({
          where: {
            userId,
          },
        }),

        tx.auditEvent.deleteMany({
          where: {
            userId,
          },
        }),

        tx.usageEvent.deleteMany({
          where: {
            userId,
          },
        }),

        tx.document.deleteMany({
          where: {
            userId,
          },
        }),

        tx.business.deleteMany({
          where: {
            userId,
          },
        }),
      ]);

    return {
      deletedAt: new Date().toISOString(),
      scope:
        "Deleted user business profile, documents, extracted data, chat messages, usage events, and audit events. Login account remains active.",
      deletedCounts: {
        chatMessages: chatMessages.count,
        auditEvents: auditEvents.count,
        usageEvents: usageEvents.count,
        documents: documents.count,
        businessProfiles: business.count,
      },
    };
  });
}

export async function deleteOwnAccountCompletely(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [chatMessages, auditEvents, usageEvents, documents, business] =
      await Promise.all([
        tx.businessChatMessage.deleteMany({
          where: {
            userId,
          },
        }),

        tx.auditEvent.deleteMany({
          where: {
            userId,
          },
        }),

        tx.usageEvent.deleteMany({
          where: {
            userId,
          },
        }),

        tx.document.deleteMany({
          where: {
            userId,
          },
        }),

        tx.business.deleteMany({
          where: {
            userId,
          },
        }),
      ]);

    const user = await tx.user.delete({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    return {
      deletedAt: new Date().toISOString(),
      scope:
        "Deleted user account and all user-owned data. Global tax knowledge/rules remain because they are platform-level resources.",
      deletedUser: {
        id: user.id,
        email: user.email,
      },
      deletedCounts: {
        chatMessages: chatMessages.count,
        auditEvents: auditEvents.count,
        usageEvents: usageEvents.count,
        documents: documents.count,
        businessProfiles: business.count,
        users: 1,
      },
    };
  });
}

export function getPrivacyControlsSummary() {
  return {
    title: "Aureli User Privacy Controls",
    principles: [
      "A user can export their own data as PDF.",
      "A user can delete their own business data.",
      "A user can delete their own account only with explicit confirmation.",
      "Admin routes cannot use these APIs.",
      "Global tax knowledge is platform data and is not included in user export/delete.",
      "No route accepts arbitrary userId from the client.",
      "The logged-in session decides which data is accessible.",
    ],
  };
}