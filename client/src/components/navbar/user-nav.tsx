import { ChevronDown, LogOut } from "lucide-react"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "../ui/avatar"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
        DropdownMenuTrigger,
  } from "../ui/dropdown-menu"
  
export function UserNav({
  userName,
  profilePicture,
  onLogout,
}: {
  userName: string;
  profilePicture: string;
  onLogout: () => void;
}) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Use a plain flex button — no shadcn Button to avoid size/overflow conflicts */}
          <button
            className="flex items-center gap-1.5 cursor-pointer outline-none focus:outline-none group"
            aria-label="Open user menu"
          >
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-white/20 group-hover:ring-white/50 transition-all duration-200">
              <AvatarImage src={profilePicture || ""} />
              <AvatarFallback className="bg-primary/40 text-white font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors duration-200" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 text-popover-foreground border-border/60 shadow-2xl shadow-black/40"
          align="end"
          forceMount
        >
          <DropdownMenuLabel className="flex flex-col items-start gap-1">
            <span className="font-semibold">{userName}</span>
             </DropdownMenuLabel>
             <DropdownMenuSeparator />
             <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent"
            onClick={onLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
    )
  }