export function AppFooter() {
  return (
    <footer className="border-t border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Eclectis</span>
        <div className="flex gap-4">
          <a href="mailto:support@eclectis.io" className="hover:text-foreground transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  )
}
