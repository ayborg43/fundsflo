import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import InsightsClient from "@/components/InsightsClient";

export default async function InsightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <InsightsClient currency={user.currency} />;
}
