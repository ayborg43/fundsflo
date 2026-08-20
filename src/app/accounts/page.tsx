import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <HomeClient email={user.email} currency={user.currency} />;
}
