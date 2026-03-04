"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Mail } from "lucide-react"

export function NewsletterAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Mail className="size-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Your newsletter ingest address
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Forward newsletters here or subscribe directly with this address.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-muted px-2.5 py-1 text-sm font-mono text-foreground">
                {address}
              </code>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                title="Copy address"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
