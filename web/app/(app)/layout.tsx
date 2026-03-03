import { redirect } from "next/navigation"
import { getUser } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader email={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
