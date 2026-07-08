"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { AureliLogo } from "./AureliLogo";

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
    label: "Setup",
    href: "/onboarding",
    enabled: true,
  },
  {
    label: "Business",
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
    label: "Chat",
    href: "/chat",
    enabled: true,
  },
  {
    label: "Tax Knowledge",
    href: "/admin/tax-knowledge",
    enabled: true,
  },
  {
    label: "CFO Report",
    href: "/reports/cfo",
    enabled: true,
  },
  {
    label: "Activity",
    href: "/activity",
    enabled: true,
  },
  {
    label: "Privacy",
    href: "/privacy",
    enabled: true,
  },
  {
    label: "Terms",
    href: "/terms",
    enabled: true,
  },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (href === "/privacy" || href === "/terms") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
          --aureli-sidebar-width: 280px;
          --aureli-shell-gap: 20px;
        }

        html,
        body {
          overflow-x: hidden !important;
          max-width: 100vw !important;
        }

        * {
          box-sizing: border-box;
        }

        .dashboard-shell {
          display: block !important;
          width: 100% !important;
          max-width: 100vw !important;
          min-height: 100dvh !important;
          padding: 16px !important;
          overflow-x: hidden !important;
        }

        .sidebar {
          position: fixed !important;
          top: 16px !important;
          left: 16px !important;
          bottom: 16px !important;
          width: var(--aureli-sidebar-width) !important;
          height: calc(100dvh - 32px) !important;
          max-height: calc(100dvh - 32px) !important;
          z-index: 50 !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .dashboard-main {
          margin-left: calc(
            var(--aureli-sidebar-width) + var(--aureli-shell-gap)
          ) !important;
          width: calc(
            100% - var(--aureli-sidebar-width) - var(--aureli-shell-gap)
          ) !important;
          max-width: calc(
            100% - var(--aureli-sidebar-width) - var(--aureli-shell-gap)
          ) !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
        }

        .sidebar-top {
          display: grid !important;
          gap: 12px !important;
          min-width: 0 !important;
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

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(245, 158, 11, 0.3);
          border-radius: 999px;
        }

        .sidebar-footer {
          margin-top: auto !important;
          flex-shrink: 0 !important;
        }

        .sidebar-mobile-signout {
          display: none !important;
        }

        @media (max-width: 980px) {
          :root {
            --aureli-sidebar-width: 0px;
            --aureli-shell-gap: 0px;
          }

          .dashboard-shell {
            display: block !important;
            width: 100vw !important;
            max-width: 100vw !important;
            padding: 10px !important;
            overflow-x: hidden !important;
          }

          .sidebar {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            padding: 10px !important;
            border-radius: 20px !important;
            display: grid !important;
            gap: 10px !important;
            overflow: hidden !important;
            margin: 0 0 12px 0 !important;
          }

          .dashboard-main {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
          }

          .sidebar-top {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .sidebar .brand {
            width: auto !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .sidebar .brand .aureli-logo {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            gap: 8px !important;
          }

          .sidebar .brand .aureli-logo-mark {
            width: 32px !important;
            height: 32px !important;
          }

          .sidebar .brand .aureli-logo-wordmark {
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .sidebar .brand .aureli-logo-name {
            font-size: 16px !important;
            white-space: nowrap !important;
          }

          .sidebar .brand .aureli-logo-tagline {
            display: none !important;
          }

          .sidebar-nav {
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 2px 1px 4px !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .sidebar-nav::-webkit-scrollbar {
            display: none !important;
          }

          .sidebar-link {
            flex: 0 0 auto !important;
            width: auto !important;
            min-width: max-content !important;
            padding: 8px 10px !important;
            border-radius: 999px !important;
            font-size: 11px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          .sidebar-footer {
            display: none !important;
          }

          .sidebar-mobile-signout {
            display: inline-flex !important;
            width: auto !important;
            min-height: 34px !important;
            padding: 8px 11px !important;
            border-radius: 999px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            flex: 0 0 auto !important;
          }

          main,
          main > *,
          main section,
          main article,
          main div,
          .section-card,
          .alerts-card,
          .cashflow-card,
          .stat-card {
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }

          main header,
          main section,
          .section-card {
            border-radius: 22px !important;
          }

          main h1 {
            font-size: clamp(34px, 11vw, 48px) !important;
            line-height: 1 !important;
          }

          main h2 {
            font-size: clamp(24px, 8vw, 34px) !important;
            line-height: 1.05 !important;
          }

          .page-intro,
          .section-hint,
          main p {
            font-size: 13px !important;
            line-height: 1.6 !important;
          }

          .btn-ghost {
            min-height: 40px !important;
            padding: 10px 13px !important;
            font-size: 12px !important;
            border-radius: 999px !important;
          }
        }

        @media (max-width: 560px) {
          .dashboard-shell {
            padding: 8px !important;
          }

          .sidebar {
            padding: 9px !important;
            border-radius: 18px !important;
          }

          .sidebar .brand .aureli-logo-mark {
            width: 30px !important;
            height: 30px !important;
          }

          .sidebar .brand .aureli-logo-name {
            font-size: 15px !important;
          }

          .sidebar-link {
            padding: 8px 9px !important;
            font-size: 10px !important;
          }

          .sidebar-mobile-signout {
            min-height: 32px !important;
            padding: 7px 10px !important;
            font-size: 10px !important;
          }

          main header,
          main section,
          .section-card {
            padding: 16px !important;
          }
        }
      `}</style>

      <aside className="sidebar">
        <div className="sidebar-top">
          <Link
            href="/dashboard"
            className="brand"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <AureliLogo size={36} showWordmark tagline="AI finance team" />
          </Link>

          <button
            type="button"
            className="btn-ghost sidebar-mobile-signout"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>

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