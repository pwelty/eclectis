import { redirect } from "next/navigation"
import { getUser, getRealUser } from "@/lib/supabase/server"
import { createServerClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { RightSidebarProvider, RightSidebar } from "@/components/right-sidebar"
import { getImpersonationState } from "@/actions/admin"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/login")

  const realUser = await getRealUser()
  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", realUser!.id)
    .single()

  const isAdmin = profile?.is_admin === true
  const impersonationState = isAdmin ? await getImpersonationState() : null

  return (
    <RightSidebarProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader
          email={user.email ?? ""}
          isAdmin={isAdmin}
          impersonating={impersonationState?.impersonating ?? null}
        />
        <div className="flex flex-1">
          <AppSidebar isAdmin={isAdmin} />
          <main className="flex-1 overflow-y-auto">{children}</main>
          <RightSidebar />
        </div>
        <AppFooter />
      </div>
    </RightSidebarProvider>
  )
}
