"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Newspaper,
  Rss,
  Search,
  Send,
  Settings,
} from "lucide-react"

const NAV_GROUPS = [
  {
    label: "Reading",
    items: [
      { href: "/articles", label: "Articles", icon: Newspaper },
    ],
  },
  {
    label: "Sources",
    items: [
      { href: "/feeds", label: "Feeds", icon: Rss },
      { href: "/search-terms", label: "Discovery", icon: Search },
    ],
  },
  {
    label: "Publishing",
    items: [
      { href: "/publishing", label: "Outputs", icon: Send },
    ],
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
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

      {/* Settings at bottom */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
