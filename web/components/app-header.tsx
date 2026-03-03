"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { LogOut, User, Menu, X } from "lucide-react"
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
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export function AppHeader({ email }: { email: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
        {/* Mobile menu button */}
        <button
          className="mr-3 md:hidden"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? (
            <X className="size-5 text-foreground" />
          ) : (
            <Menu className="size-5 text-foreground" />
          )}
        </button>

        {/* Mobile brand */}
        <Link href="/articles" className="text-base font-semibold text-foreground md:hidden">
          Eclectis
        </Link>

        <div className="flex-1" />

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
            className="gap-2 text-muted-foreground"
          >
            <User className="size-4" />
            <span className="hidden text-sm sm:inline">{email}</span>
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile navigation overlay */}
      {mobileNavOpen && (
        <nav className="border-b border-border bg-background px-4 py-2 md:hidden">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      )}
    </>
  )
}
