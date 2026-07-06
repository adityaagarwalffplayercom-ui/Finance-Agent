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
            --aureli-sidebar-width: 250px;
            --aureli-shell-gap: 16px;
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
          <AureliLogo size={36} showWordmark tagline="AI finance team" />
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