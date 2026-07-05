"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

type SidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
};

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    enabled: true,
  },
  {
    label: "Setup Guide",
    href: "/onboarding",
    enabled: true,
  },
  {
    label: "Business Profile",
    href: "/business",
    enabled: true,
  },
  {
    label: "Documents",
    href: "/documents",
    enabled: true,
  },
  {
    label: "AI Team",
    href: "/ai-team",
    enabled: true,
  },
  {
    label: "AI Business Chat",
    href: "/chat",
    enabled: true,
  },
  {
    label: "Reports",
    href: "/reports/cfo",
    enabled: true,
  },
  {
    label: "Activity",
    href: "/activity",
    enabled: true,
  },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function LedgerLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
      }}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <line
        x1="7"
        y1="9"
        x2="17"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.6"
      />

      <line
        x1="7"
        y1="13"
        x2="15"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.6"
      />

      <circle cx="21" cy="7" r="5" fill="var(--color-amber)" opacity="0.9" />
    </svg>
  );
}

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <style jsx global>{`
        :root {
          --ledger-sidebar-width: 280px;
          --ledger-shell-gap: 20px;
        }

        .dashboard-shell {
          display: block !important;
          width: 100% !important;
          min-height: 100dvh !important;
          padding: 16px !important;
          box-sizing: border-box !important;
        }

        .sidebar {
          position: fixed !important;
          top: 16px !important;
          left: 16px !important;
          bottom: 16px !important;
          width: var(--ledger-sidebar-width) !important;
          height: calc(100dvh - 32px) !important;
          max-height: calc(100dvh - 32px) !important;
          z-index: 50 !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .dashboard-main {
          margin-left: calc(
            var(--ledger-sidebar-width) + var(--ledger-shell-gap)
          ) !important;
          width: calc(
            100% - var(--ledger-sidebar-width) - var(--ledger-shell-gap)
          ) !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .sidebar-nav {
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding-right: 2px !important;
          min-height: 0 !important;
        }

        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(245, 158, 11, 0.3);
          border-radius: 999px;
        }

        .sidebar-footer {
          margin-top: auto !important;
          flex-shrink: 0 !important;
        }

        @media (max-width: 1180px) {
          :root {
            --ledger-sidebar-width: 250px;
            --ledger-shell-gap: 16px;
          }
        }

        @media (max-width: 980px) {
          .dashboard-shell {
            display: grid !important;
            gap: 16px !important;
            padding: 12px !important;
          }

          .sidebar {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            bottom: auto !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .dashboard-main {
            margin-left: 0 !important;
            width: 100% !important;
          }

          .sidebar-nav {
            overflow: visible !important;
            padding-right: 0 !important;
          }
        }
      `}</style>

      <aside className="sidebar">
        <Link
          href="/dashboard"
          className="brand"
          style={{
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <LedgerLogo />
          <span className="brand-word">Ledger</span>
        </Link>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.filter((item) => item.enabled).map((item) => {
            const active = isActiveLink(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${
                  active ? "sidebar-link-active" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div
            style={{
              minWidth: 0,
            }}
          >
            <p className="sidebar-user-name">
              {userName?.trim() || "Workspace user"}
            </p>

            <p className="sidebar-user-email">
              {userEmail?.trim() || "Signed in"}
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleSignOut}
            style={{
              width: "100%",
              justifyContent: "center",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}