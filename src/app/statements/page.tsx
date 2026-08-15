import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StatementsClient from "@/components/StatementsClient";

export default async function StatementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <StatementsClient />;
}
