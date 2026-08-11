import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import CategoriesClient from "@/components/CategoriesClient";

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CategoriesClient />;
}
