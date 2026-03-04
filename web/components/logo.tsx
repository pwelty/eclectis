import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e2a3a" />
          <stop offset="100%" stopColor="#141d29" />
        </linearGradient>
        <linearGradient id="logo-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e4a843" />
          <stop offset="100%" stopColor="#db9226" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="108" fill="url(#logo-bg)" />
      <rect x="128" y="120" width="256" height="48" rx="8" fill="#b8c3d1" />
      <rect x="128" y="232" width="192" height="48" rx="8" fill="url(#logo-amber)" />
      <rect x="128" y="344" width="256" height="48" rx="8" fill="#b8c3d1" />
      <rect x="128" y="120" width="48" height="272" rx="8" fill="#dce1e8" />
    </svg>
  )
}
