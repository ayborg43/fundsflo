import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BillsClient from "@/components/BillsClient";

export default async function BillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <BillsClient currency={user.currency} />;
}
