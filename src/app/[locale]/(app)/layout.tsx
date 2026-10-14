import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { getSessionUser } from "@/server/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect(`/${await getLocale()}/login`);

  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <AppSidebar user={user} />
      <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
