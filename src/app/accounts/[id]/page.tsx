import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AccountDetailClient from "@/components/AccountDetailClient";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  return <AccountDetailClient accountId={id} currency={user.currency} />;
}
