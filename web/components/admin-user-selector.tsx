"use client"

import { useState, useEffect, useTransition } from "react"
import { Eye, EyeOff, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getImpersonatableUsers,
  setImpersonation,
  clearImpersonation,
} from "@/actions/admin"
import { cn } from "@/lib/utils"

interface User {
  id: string
  name: string | null
  email: string
  plan: string
}

interface Props {
  impersonating: { id: string; name: string | null; email: string } | null
}

export function AdminUserSelector({ impersonating }: Props) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && users.length === 0) {
      setLoading(true)
      getImpersonatableUsers().then((res) => {
        if (res.users) setUsers(res.users)
        setLoading(false)
      })
    }
  }, [open, users.length])

  function handleSelect(userId: string) {
    startTransition(async () => {
      await setImpersonation(userId)
      setOpen(false)
      window.location.reload()
    })
  }

  function handleClear() {
    startTransition(async () => {
      await clearImpersonation()
      window.location.reload()
    })
  }

  if (impersonating) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Eye className="size-3" />
          <span>Viewing as {impersonating.name || impersonating.email}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isPending}
          className="h-7 gap-1.5 text-xs text-muted-foreground"
        >
          <EyeOff className="size-3" />
          Stop
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-7 gap-1 text-xs text-muted-foreground"
      >
        <Eye className="size-3" />
        View as
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-card py-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading users...</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">
                      {user.name || user.email}
                    </p>
                    {user.name && (
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{user.plan}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
