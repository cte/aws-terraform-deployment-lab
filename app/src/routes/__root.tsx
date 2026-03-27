import { Link, Outlet, createRootRoute } from "@tanstack/react-router"
import { ThemeToggle } from "@/components/app/theme-toggle.tsx"
import { Toaster } from "@/components/ui/sonner.tsx"

function NavLink({ to, label }: { to: "/" | "/jobs/new"; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      activeProps={{
        className: "text-foreground",
      }}
      className="text-sm text-muted-foreground transition hover:text-foreground"
    >
      {label}
    </Link>
  )
}

function RootLayout() {
  return (
    <>
      <div className="min-h-dvh">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-sm font-semibold">
                Ember Migration Lab
              </Link>
              <nav className="flex items-center gap-4">
                <NavLink to="/" label="Dashboard" />
                <NavLink to="/jobs/new" label="New Job" />
              </nav>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </>
  )
}

function RootError() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reload the page or return to the dashboard. If this keeps happening,
        check the API and worker logs.
      </p>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
})
