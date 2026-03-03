import Link from "next/link"

export default function ArticlesPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Your articles</h1>
        <p className="mt-2 text-muted-foreground">
          Your curated articles will appear here after the first scan completes.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Add more sources
        </Link>
      </div>
    </div>
  )
}
