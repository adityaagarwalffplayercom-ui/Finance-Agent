import Link from "next/link";
import { headers } from "next/headers";
import {
  DocumentReviewStatus,
  DocumentStatus,
  LedgerDirection,
  LedgerEntryStatus,
  LedgerSourceType,
  Prisma,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddManualTransaction } from "./AddManualTransaction";
import {
  LedgerReviewTable,
  type ReviewTableEntry,
} from "./LedgerReviewTable";
import { LedgerSyncButton } from "./LedgerSyncButton";
import styles from "./ledger.module.css";

export const dynamic = "force-dynamic";

type LedgerPageProps = {
  searchParams: Promise<{
    q?: string;
    direction?: string;
    status?: string;
    source?: string;
  }>;
};

type MetricTone =
  | "default"
  | "positive"
  | "negative"
  | "accent";

function isDirection(
  value: string | undefined,
): value is LedgerDirection {
  return Object.values(
    LedgerDirection,
  ).includes(
    value as LedgerDirection,
  );
}

function isStatus(
  value: string | undefined,
): value is LedgerEntryStatus {
  return Object.values(
    LedgerEntryStatus,
  ).includes(
    value as LedgerEntryStatus,
  );
}

function isSource(
  value: string | undefined,
): value is LedgerSourceType {
  return Object.values(
    LedgerSourceType,
  ).includes(
    value as LedgerSourceType,
  );
}

function removeTrailingZeros(value: string) {
  return value
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatCompactNumber(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    const decimals =
      absoluteValue >= 10_000_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000_000
      ).toFixed(decimals),
    )}B`;
  }

  if (absoluteValue >= 1_000_000) {
    const decimals =
      absoluteValue >= 10_000_000
        ? 1
        : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000_000
      ).toFixed(decimals),
    )}M`;
  }

  if (absoluteValue >= 1_000) {
    const decimals =
      absoluteValue >= 100_000
        ? 0
        : absoluteValue >= 10_000
          ? 1
          : 2;

    return `${removeTrailingZeros(
      (
        absoluteValue /
        1_000
      ).toFixed(decimals),
    )}K`;
  }

  return absoluteValue.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    },
  );
}

function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    AED: "د.إ ",
    CAD: "C$",
    AUD: "A$",
  };

  return (
    symbols[currency.toUpperCase()] ??
    `${currency.toUpperCase()} `
  );
}

function formatMoney(
  value: number,
  currency: string,
) {
  const sign = value < 0 ? "−" : "";

  return `${sign}${getCurrencySymbol(
    currency,
  )}${formatCompactNumber(value)}`;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function getMetricToneClass(
  tone: MetricTone,
) {
  if (tone === "positive") {
    return styles.metricPositive;
  }

  if (tone === "negative") {
    return styles.metricNegative;
  }

  if (tone === "accent") {
    return styles.metricAccent;
  }

  return styles.metricDefault;
}

function MetricTile({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: string;
  caption: string;
  tone?: MetricTone;
}) {
  return (
    <div
      className={`${styles.metricTile} ${getMetricToneClass(
        tone,
      )}`}
    >
      <div className={styles.metricTop}>
        <span className={styles.metricLabel}>
          {label}
        </span>

        <span className={styles.metricDot} />
      </div>

      <strong className={styles.metricValue}>
        {value}
      </strong>

      <span className={styles.metricCaption}>
        {caption}
      </span>
    </div>
  );
}

export default async function LedgerPage({
  searchParams,
}: LedgerPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const params = await searchParams;

  const query = params.q?.trim() ?? "";

  const direction = isDirection(
    params.direction,
  )
    ? params.direction
    : undefined;

  const selectedStatus = isStatus(
    params.status,
  )
    ? params.status
    : undefined;

  const source = isSource(params.source)
    ? params.source
    : undefined;

  const filtersActive = Boolean(
    query ||
      direction ||
      selectedStatus ||
      source,
  );

  const where: Prisma.LedgerEntryWhereInput = {
    userId: session.user.id,

    ...(direction
      ? {
          direction,
        }
      : {}),

    ...(selectedStatus
      ? {
          status: selectedStatus,
        }
      : {}),

    ...(source
      ? {
          sourceType: source,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              description: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              counterparty: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              category: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              document: {
                is: {
                  fileName: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [
    entries,
    totalEntries,
    reviewCount,
    approvedCount,
    rejectedCount,
    approvedDocuments,
  ] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
      orderBy: [
        {
          transactionDate: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 500,
    }),

    prisma.ledgerEntry.count({
      where: {
        userId: session.user.id,
      },
    }),

    prisma.ledgerEntry.count({
      where: {
        userId: session.user.id,
        status:
          LedgerEntryStatus.NEEDS_REVIEW,
      },
    }),

    prisma.ledgerEntry.count({
      where: {
        userId: session.user.id,
        status:
          LedgerEntryStatus.APPROVED,
      },
    }),

    prisma.ledgerEntry.count({
      where: {
        userId: session.user.id,
        status:
          LedgerEntryStatus.REJECTED,
      },
    }),

    prisma.document.count({
      where: {
        userId: session.user.id,
        status:
          DocumentStatus.PROCESSED,
        reviewStatus:
          DocumentReviewStatus.APPROVED,
      },
    }),
  ]);

  const primaryCurrency =
    entries.find((entry) => entry.currency)
      ?.currency ?? "INR";

  const trustedEntries = entries.filter(
    (entry) =>
      entry.status ===
        LedgerEntryStatus.APPROVED &&
      entry.currency === primaryCurrency,
  );

  const creditTotal = trustedEntries
    .filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.CREDIT,
    )
    .reduce(
      (total, entry) =>
        total + Number(entry.amount),
      0,
    );

  const debitTotal = trustedEntries
    .filter(
      (entry) =>
        entry.direction ===
        LedgerDirection.DEBIT,
    )
    .reduce(
      (total, entry) =>
        total + Number(entry.amount),
      0,
    );

  const netFlow =
    creditTotal - debitTotal;

  const tableEntries: ReviewTableEntry[] =
    entries.map((entry) => ({
      id: entry.id,
      transactionDate:
        entry.transactionDate?.toISOString() ??
        null,
      description: entry.description,
      counterparty: entry.counterparty,
      category: entry.category,
      direction: entry.direction,
      amount: entry.amount.toString(),
      currency: entry.currency,
      confidence: entry.confidence,
      status: entry.status,
      sourceType: entry.sourceType,
      document: entry.document,
    }));

  function createTabHref(
    status?: LedgerEntryStatus,
  ) {
    const nextParams =
      new URLSearchParams();

    if (query) {
      nextParams.set("q", query);
    }

    if (direction) {
      nextParams.set(
        "direction",
        direction,
      );
    }

    if (source) {
      nextParams.set("source", source);
    }

    if (status) {
      nextParams.set("status", status);
    }

    const value = nextParams.toString();

    return value
      ? `/ledger?${value}`
      : "/ledger";
  }

  const tabs = [
    {
      label: "All entries",
      status: undefined,
      count: totalEntries,
    },
    {
      label: "Needs review",
      status:
        LedgerEntryStatus.NEEDS_REVIEW,
      count: reviewCount,
    },
    {
      label: "Approved",
      status:
        LedgerEntryStatus.APPROVED,
      count: approvedCount,
    },
    {
      label: "Rejected",
      status:
        LedgerEntryStatus.REJECTED,
      count: rejectedCount,
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <div className={styles.titleRow}>
                <span className={styles.eyebrow}>
                  Financial data layer
                </span>

                <span className={styles.livePill}>
                  <span className={styles.liveDot} />
                  Live ledger
                </span>
              </div>

              <h1 className={styles.title}>
                Transaction Ledger
              </h1>

              <p className={styles.subtitle}>
                Documents are approved only once.
                Their ledger entries become trusted
                automatically, while this page remains
                available for audit and corrections.
              </p>
            </div>

            <div className={styles.heroActions}>
              <AddManualTransaction
                defaultCurrency={
                  primaryCurrency
                }
              />

              <LedgerSyncButton
                approvedDocuments={
                  approvedDocuments
                }
              />
            </div>
          </div>

          <div className={styles.metricGrid}>
            <MetricTile
              label="Ledger entries"
              value={totalEntries.toLocaleString(
                "en-IN",
              )}
              caption={`${approvedCount} trusted · ${reviewCount} awaiting review`}
              tone="accent"
            />

            <MetricTile
              label="Approved credits"
              value={formatMoney(
                creditTotal,
                primaryCurrency,
              )}
              caption="Trusted money flowing in"
              tone="positive"
            />

            <MetricTile
              label="Approved debits"
              value={formatMoney(
                debitTotal,
                primaryCurrency,
              )}
              caption="Trusted money flowing out"
              tone="negative"
            />

            <MetricTile
              label="Trusted net movement"
              value={formatMoney(
                netFlow,
                primaryCurrency,
              )}
              caption={`${rejectedCount} rejected entr${
                rejectedCount === 1
                  ? "y"
                  : "ies"
              } excluded`}
              tone={
                netFlow >= 0
                  ? "positive"
                  : "negative"
              }
            />
          </div>
        </div>
      </header>

      <section
        className={styles.ledgerSurface}
      >
        <div className={styles.surfaceHeader}>
          <div>
            <span
              className={styles.surfaceEyebrow}
            >
              Review workspace
            </span>

            <h2
              className={styles.surfaceTitle}
            >
              Financial activity
            </h2>

            <p
              className={
                styles.surfaceDescription
              }
            >
              Audit trusted entries, correct mistakes,
              or reject duplicated rows when needed.
            </p>
          </div>

          <div className={styles.surfaceMeta}>
            <span>
              Showing{" "}
              <strong>{entries.length}</strong>{" "}
              of{" "}
              <strong>{totalEntries}</strong>
            </span>

            {filtersActive ? (
              <Link
                href="/ledger"
                className={
                  styles.clearButton
                }
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>

        <nav
          className={styles.reviewTabs}
          aria-label="Ledger review status"
        >
          {tabs.map((tab) => {
            const active =
              selectedStatus === tab.status ||
              (!selectedStatus &&
                !tab.status);

            return (
              <Link
                key={tab.label}
                href={createTabHref(
                  tab.status,
                )}
                className={`${styles.reviewTab} ${
                  active
                    ? styles.reviewTabActive
                    : ""
                }`}
              >
                <span>{tab.label}</span>

                <strong>{tab.count}</strong>
              </Link>
            );
          })}
        </nav>

        <form
          action="/ledger"
          method="get"
          className={styles.filters}
        >
          {selectedStatus ? (
            <input
              type="hidden"
              name="status"
              value={selectedStatus}
            />
          ) : null}

          <label
            className={styles.searchField}
          >
            <span
              className={styles.fieldLabel}
            >
              Search ledger
            </span>

            <div
              className={
                styles.searchInputWrap
              }
            >
              <span
                className={styles.searchIcon}
              >
                ⌕
              </span>

              <input
                name="q"
                defaultValue={query}
                placeholder="Vendor, description, category or file"
                className={styles.input}
              />
            </div>
          </label>

          <label className={styles.field}>
            <span
              className={styles.fieldLabel}
            >
              Direction
            </span>

            <select
              name="direction"
              defaultValue={
                direction ?? ""
              }
              className={styles.select}
            >
              <option value="">
                All directions
              </option>

              {Object.values(
                LedgerDirection,
              ).map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span
              className={styles.fieldLabel}
            >
              Source
            </span>

            <select
              name="source"
              defaultValue={source ?? ""}
              className={styles.select}
            >
              <option value="">
                All sources
              </option>

              {Object.values(
                LedgerSourceType,
              ).map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  {humanize(value)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className={styles.filterButton}
          >
            Apply filters
          </button>
        </form>

        <LedgerReviewTable
          entries={tableEntries}
          approvedDocuments={
            approvedDocuments
          }
          filtersActive={filtersActive}
        />
      </section>
    </div>
  );
}