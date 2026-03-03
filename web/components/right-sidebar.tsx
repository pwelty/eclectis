"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface RightSidebarContextValue {
  content: ReactNode | null
  setContent: (content: ReactNode | null) => void
  isOpen: boolean
  open: (content: ReactNode) => void
  close: () => void
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null)

export function useRightSidebar() {
  const ctx = useContext(RightSidebarContext)
  if (!ctx) throw new Error("useRightSidebar must be used within RightSidebarProvider")
  return ctx
}

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)

  const open = useCallback((node: ReactNode) => setContent(node), [])
  const close = useCallback(() => setContent(null), [])

  return (
    <RightSidebarContext.Provider
      value={{ content, setContent, isOpen: content !== null, open, close }}
    >
      {children}
    </RightSidebarContext.Provider>
  )
}

export function RightSidebar() {
  const { content } = useRightSidebar()
  if (!content) return null

  return (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-background md:block">
      {content}
    </aside>
  )
}
