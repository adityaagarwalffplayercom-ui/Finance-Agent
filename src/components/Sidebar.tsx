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
    label: "User Demo",
    href: "/demo",
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
    label: "Transaction Ledger",
    href: "/ledger",
    enabled: true,
  },
  {
    label: "Document Check",
    href: "/document-completeness",
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
    label: "CFO Report",
    href: "/reports/cfo",
    enabled: true,
  },
  {
    label: "CFO Decisions",
    href: "/cfo-decisions",
    enabled: true,
  },
  {
    label: "Monthly Report",
    href: "/reports/monthly",
    enabled: true,
  },
  {
    label: "Risk Score",
    href: "/risk-score",
    enabled: true,
  },
  {
    label: "Anomaly Insights",
    href: "/anomaly-insights",
    enabled: true,
  },
{
    label: "Cash Flow",
    href: "/cash-flow",
    enabled: true,
  },
{
    label: "Forecast",
    href: "/forecast",
    enabled: true,
  },
{
    label: "Decision Center",
    href: "/decision-center",
    enabled: true,
  },
{
    label: "Learning Center",
    href: "/learning-center",
    enabled: true,
  },
{
    label: "Activity",
    href: "/activity",
    enabled: true,
  },
  {
    label: "Tax Coverage",
    href: "/tax-coverage",
    enabled: true,
  },
  {
    label: "Settings & Team",
    href: "/settings",
    enabled: true,
  },
  {
    label: "Privacy",
    href: "/privacy",
    enabled: true,
  },
  {
    label: "Legal & Tax Info",
    href: "/legal",
    enabled: true,
  },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
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

        .sidebar-nav::-webkit-scrollbar-thumb{background:rgba(52,70,96,.78)!important;background-image:none!important;border-radius:999px!important;border:1px solid rgba(5,10,18,.62)!important;box-shadow:none!important}


        /* AURELI_ACTIVE_NAV_BOX */
        .sidebar-link {
          position: relative !important;
          width: 100% !important;
          border: 1px solid transparent !important;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease !important;
        }

        .sidebar-link:not(.sidebar-link-active):hover {
          background: rgba(70, 91, 120, 0.10) !important;
          border-color: rgba(94, 122, 158, 0.16) !important;
          color: var(--color-text-primary) !important;
        }

        .sidebar-link-active {
          background:
            linear-gradient(
              135deg,
              rgba(70, 91, 120, 0.30),
              rgba(42, 55, 76, 0.22)
            ) !important;
          border: 1px solid rgba(94, 122, 158, 0.48) !important;
          border-radius: 14px !important;
          color: #f4f7fb !important;
          font-weight: 900 !important;
          box-shadow:
            inset 3px 0 0 rgba(112, 145, 184, 0.95),
            0 10px 24px rgba(0, 0, 0, 0.20) !important;
          transform: translateX(1px);
        }

        .sidebar-link-active::after {
          content: "";
          position: absolute;
          top: 50%;
          right: 11px;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(132, 168, 210, 0.95);
          box-shadow: 0 0 12px rgba(112, 145, 184, 0.75);
          transform: translateY(-50%);
        }
        .sidebar-footer {
          margin-top: auto !important;
          flex-shrink: 0 !important;
        }

        .sidebar-mobile-signout {
          display: none !important;
        }

        /* Desktop sidebar slider / scrollbar */
        @media (min-width: 981px) {
          .sidebar {
            padding-bottom: 14px !important;
          }

          .sidebar-nav {
            flex: 1 1 auto !important;
            max-height: calc(100dvh - 210px) !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding: 4px 7px 8px 0 !important;
            margin-right: -4px !important;
            scroll-behavior: smooth !important;
            scrollbar-width: thin !important;
            scrollbar-color: rgba(70, 91, 120, 0.82) transparent !important;
          }

          .sidebar-nav::-webkit-scrollbar {
            width: 7px !important;
          }

          .sidebar-nav::-webkit-scrollbar-track{background:transparent!important;border-radius:999px!important;box-shadow:none!important}

          .sidebar-nav::-webkit-scrollbar-thumb{background:rgba(52,70,96,.78)!important;background-image:none!important;border-radius:999px!important;border:1px solid rgba(5,10,18,.62)!important;box-shadow:none!important}

          .sidebar-nav::-webkit-scrollbar-thumb:hover{background:rgba(78,104,138,.92)!important;background-image:none!important;box-shadow:none!important}

          .sidebar-link {
            min-height: 38px !important;
            padding-top: 9px !important;
            padding-bottom: 9px !important;
          }

          .sidebar-footer {
            padding-top: 12px !important;
          }
        }

        /* AURELI_SCOPED_SCROLL_FIX */
        @media (min-width: 981px) {
          /*
           * Keep browser/body fixed.
           * The app content itself becomes the scroll container.
           */
          html,
          body {
            width: 100%;
            height: 100%;
            overflow: hidden !important;
          }

          .dashboard-shell {
            width: 100% !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }

          /*
           * Main app scrollbar is now inside the Aureli workspace,
           * instead of appearing as an outside browser scrollbar.
           */
          .dashboard-main {
            height: calc(100dvh - 32px) !important;
            max-height: calc(100dvh - 32px) !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
            scrollbar-width: thin !important;
            scrollbar-color:
              rgba(70, 91, 120, 0.78)
              transparent !important;
          }

          .dashboard-main::-webkit-scrollbar {
            width: 8px !important;
            height: 8px !important;
          }

          .dashboard-main::-webkit-scrollbar-track {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .dashboard-main::-webkit-scrollbar-thumb {
            min-height: 44px;
            border: 2px solid transparent !important;
            border-radius: 999px !important;
            background:
              rgba(70, 91, 120, 0.78) !important;
            background-color:
              rgba(70, 91, 120, 0.78) !important;
            background-image: none !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          .dashboard-main::-webkit-scrollbar-thumb:hover {
            background:
              rgba(94, 122, 158, 0.94) !important;
            background-color:
              rgba(94, 122, 158, 0.94) !important;
            background-image: none !important;
          }

          .dashboard-main::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }

          /*
           * Remove the sidebar's separate inner box/layer.
           */
          .sidebar-nav,
          .aureli-sidebar-scroll {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 4px 6px 8px 0 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            background: transparent !important;
            background-image: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none !important;
            overscroll-behavior: contain;
            scrollbar-gutter: auto;
            scrollbar-width: thin !important;
            scrollbar-color:
              rgba(70, 91, 120, 0.82)
              transparent !important;
          }

          .sidebar-nav::-webkit-scrollbar,
          .aureli-sidebar-scroll::-webkit-scrollbar {
            width: 6px !important;
            height: 6px !important;
          }

          .sidebar-nav::-webkit-scrollbar-track,
          .aureli-sidebar-scroll::-webkit-scrollbar-track {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .sidebar-nav::-webkit-scrollbar-thumb,
          .aureli-sidebar-scroll::-webkit-scrollbar-thumb {
            min-height: 38px;
            border: 1px solid transparent !important;
            border-radius: 999px !important;
            background:
              rgba(70, 91, 120, 0.82) !important;
            background-color:
              rgba(70, 91, 120, 0.82) !important;
            background-image: none !important;
            background-clip: padding-box !important;
            box-shadow: none !important;
          }

          .sidebar-nav::-webkit-scrollbar-thumb:hover,
          .aureli-sidebar-scroll::-webkit-scrollbar-thumb:hover {
            background:
              rgba(94, 122, 158, 0.96) !important;
            background-color:
              rgba(94, 122, 158, 0.96) !important;
            background-image: none !important;
          }

          .sidebar-nav::-webkit-scrollbar-button,
          .aureli-sidebar-scroll::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
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

        <nav className="sidebar-nav aureli-sidebar-scroll" aria-label="Main navigation">
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









