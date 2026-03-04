import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/actions/admin"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/articles")

  return <>{children}</>
}
