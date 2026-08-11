import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BudgetsClient from "@/components/BudgetsClient";

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <BudgetsClient currency={user.currency} />;
}
