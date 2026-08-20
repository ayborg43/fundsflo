import { redirect } from "next/navigation";

// Chat is the home screen now. Kept so existing bookmarks (and any installed
// PWA shortcut) don't 404.
export default function ChatPage() {
  redirect("/");
}
