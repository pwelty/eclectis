"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Rss,
  Search,
  Lightbulb,
  Settings,
  Newspaper,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/articles", label: "Articles", icon: Newspaper },
  { href: "/feeds", label: "Feeds", icon: Rss },
  { href: "/search-terms", label: "Discovery", icon: Search },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center px-5">
        <Link href="/articles" className="text-lg font-semibold text-sidebar-primary-foreground">
          Eclectis
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
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
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-sidebar-border px-3 py-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
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
