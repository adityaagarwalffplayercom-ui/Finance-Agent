"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { authClient } from "@/lib/auth-client";

type SidebarProps = {
  userName: string;
  userEmail: string;
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Setup Guide", href: "/onboarding", enabled: true },
  { label: "Business Profile", href: "/business", enabled: true },
  { label: "Documents", href: "/documents", enabled: true },
  { label: "AI Team", href: "/ai-team", enabled: true },
  { label: "AI Business Chat", href: "/chat", enabled: true },
  { label: "Reports", href: "/reports/cfo", enabled: true },
  { label: "Activity", href: "/activity", enabled: true },
];

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <Brand />

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          if (!item.enabled) {
            return (
              <span
                key={item.label}
                className="sidebar-link sidebar-link-disabled"
              >
                {item.label}
                <span className="soon-tag">Soon</span>
              </span>
            );
          }

          const isActive =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${
                isActive ? "sidebar-link-active" : ""
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div>
          <p className="sidebar-user-name">{userName}</p>
          <p className="sidebar-user-email">{userEmail}</p>
        </div>

        <button type="button" className="btn-ghost" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}