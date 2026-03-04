"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getAdminDashboard } from "@/actions/admin"
import { Users, Terminal, DollarSign, Loader2 } from "lucide-react"

interface DashboardData {
  users: { total: number; pro: number; free: number }
  commands: { pending: number; processing: number; completed: number; failed: number }
  usage: { total_cost: number; total_calls: number }
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getAdminDashboard()
      if (!("error" in result)) {
        setData(result as DashboardData)
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

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load dashboard data.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Users"
          value={data.users.total}
          subtitle={`${data.users.pro} pro, ${data.users.free} free`}
          icon={Users}
          href="/admin/users"
        />
        <StatCard
          title="Pipeline"
          value={data.commands.pending + data.commands.processing}
          subtitle={`${data.commands.pending} pending, ${data.commands.failed} failed`}
          icon={Terminal}
          href="/admin/pipeline"
        />
        <StatCard
          title="AI cost"
          value={`$${Number(data.usage.total_cost).toFixed(2)}`}
          subtitle={`${data.usage.total_calls} calls total`}
          icon={DollarSign}
          href="/admin/usage"
        />
      </div>
    </div>
  )
}
