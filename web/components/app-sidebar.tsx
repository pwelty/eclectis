"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Newspaper,
  Rss,
  Mail,
  Headphones,
  Bookmark,
  Search,
  Send,
  Settings,
  Shield,
  Users,
  Terminal,
  DollarSign,
} from "lucide-react"

const NAV_GROUPS = [
  {
    label: "Reading",
    items: [
      { href: "/articles", label: "Articles", icon: Newspaper },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "Sources",
    items: [
      { href: "/feeds", label: "RSS", icon: Rss },
      { href: "/newsletters", label: "Newsletters", icon: Mail },
      { href: "/podcasts", label: "Podcasts", icon: Headphones },
      { href: "/search-terms", label: "Search", icon: Search },
    ],
  },
  {
    label: "Publishing",
    items: [
      { href: "/publishing", label: "Outputs", icon: Send },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const

const ADMIN_NAV = {
  label: "Admin",
  items: [
    { href: "/admin", label: "Dashboard", icon: Shield },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/pipeline", label: "Pipeline", icon: Terminal },
    { href: "/admin/usage", label: "Usage", icon: DollarSign },
  ],
}

export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_NAV] : NAV_GROUPS

  return (
    <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  )
}
