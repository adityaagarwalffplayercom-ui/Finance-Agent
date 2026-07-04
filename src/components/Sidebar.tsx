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
  { label: "Documents", href: "/documents", enabled: true },
  { label: "Ask your team", href: "#", enabled: false },
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
              <span key={item.label} className="sidebar-link sidebar-link-disabled">
                {item.label}
                <span className="soon-tag">Soon</span>
              </span>
            );
          }

          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"}
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
