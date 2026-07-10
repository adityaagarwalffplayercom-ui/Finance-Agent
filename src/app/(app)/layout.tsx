import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="dashboard-shell">
      <Sidebar
        userName={session.user.name ?? "Account"}
        userEmail={session.user.email ?? ""}
      />

      <main className="dashboard-main">{children}</main>
    </div>
  );
}