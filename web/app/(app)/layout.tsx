import { redirect } from "next/navigation"
import { getUser } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/login")
  return <div className="min-h-screen bg-background">{children}</div>
}
