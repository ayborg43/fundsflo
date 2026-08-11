import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChatView from "@/components/ChatView";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ChatView />;
}
