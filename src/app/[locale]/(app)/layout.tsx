import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSessionUser } from "@/server/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect(`/${await getLocale()}/login`);

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
