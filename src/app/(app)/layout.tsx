import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="dashboard-shell">
      <Sidebar userName={session?.user?.name ?? "Account"} userEmail={session?.user?.email ?? ""} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
