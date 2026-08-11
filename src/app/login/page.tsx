import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage() {
  const userId = await getSessionUserId();
  if (userId) redirect("/");

  return <AuthForm mode="login" />;
}
