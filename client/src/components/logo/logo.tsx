import { PROTECTED_ROUTES } from "@/routes/common/routePath"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"

type LogoMode = "full" | "mini" | "auto"

type LogoProps = {
  url?: string
  mode?: LogoMode
  className?: string
  fullClassName?: string
  miniClassName?: string
}

const Logo = ({
  url,
  mode = "full",
  className,
  fullClassName,
  miniClassName,
}: LogoProps) => {
  return (
    <Link
      to={url || PROTECTED_ROUTES.OVERVIEW}
      className={cn("inline-flex items-center", className)}
      aria-label="Pocket Planner"
    >
      {(mode === "full" || mode === "auto") && (
        <img
          src="/Logo.png"
          alt="Pocket Planner"
          className={cn(
            "h-25 w-auto object-contain drop-shadow-sm",
            mode === "auto" ? "hidden sm:block" : "block",
            fullClassName
          )}
        />
      )}

      {(mode === "mini" || mode === "auto") && (
        <img
          src="/Mini-Logo.png"
          alt="Pocket Planner mini logo"
          className={cn(
            "h-12 w-12 object-contain drop-shadow-sm",
            mode === "auto" ? "block sm:hidden" : "block",
            miniClassName
          )}
        />
      )}
    </Link>
  )
}

export default Logo