import { redirect } from "next/navigation"
import { getUser } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { RightSidebarProvider, RightSidebar } from "@/components/right-sidebar"
import { PostHogIdentify } from "@/components/posthog-provider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/login")

  return (
    <RightSidebarProvider>
      <PostHogIdentify userId={user.id} email={user.email ?? ""} />
      <div className="flex min-h-screen flex-col">
        <AppHeader email={user.email ?? ""} />
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
          <RightSidebar />
        </div>
        <AppFooter />
      </div>
    </RightSidebarProvider>
  )
}
