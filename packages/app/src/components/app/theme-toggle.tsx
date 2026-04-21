import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "@/components/theme-provider.tsx"
import { Button } from "@/components/ui/button.tsx"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="rounded-full"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        setTheme(isDark ? "light" : "dark")
      }}
    >
      {isDark ? <SunMedium /> : <MoonStar />}
    </Button>
  )
}
