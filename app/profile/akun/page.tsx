import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { AkunInfo } from "@/components/AkunInfo";

export default async function AkunPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  return <AkunInfo user={user} />;
}
