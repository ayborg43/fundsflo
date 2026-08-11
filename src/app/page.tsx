import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import HomeClient from "@/components/HomeClient";

export default async function Home() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await findUserById(userId);
  if (!user) redirect("/login");

  return <HomeClient email={user.email} />;
}
