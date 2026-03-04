"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getAdminUsers } from "@/actions/admin"
import { Loader2, Crown, ChevronRight } from "lucide-react"

interface AdminUser {
  id: string
  name: string | null
  email: string
  plan: string
  is_admin: boolean
  created_at: string
  updated_at: string
  feedCount: number
  searchTermCount: number
  subscription_status: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getAdminUsers()
      if (!result.error) {
        setUsers(result.users as AdminUser[])
        setTotal(result.total)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Feeds</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Search</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Signed up</th>
              <th className="w-8 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {user.name || "—"}
                      {user.is_admin && (
                        <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    user.plan === "pro"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {user.plan === "pro" && <Crown className="size-3" />}
                    {user.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{user.feedCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{user.searchTermCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${user.id}`} className="text-muted-foreground hover:text-foreground">
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
