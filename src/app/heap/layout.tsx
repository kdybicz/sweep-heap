import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserMemberships } from "@/lib/repositories";

export default async function HeapLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) {
    redirect("/auth");
  }

  const memberships = await getUserMemberships(userId);
  if (!memberships.length) {
    redirect("/household/setup");
  }

  return <>{children}</>;
}
