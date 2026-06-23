import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut, Menu, Search, Plus, LayoutDashboard, User as UserIcon, MapPin, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {user && (
            <>
              <Button variant="ghost" asChild>
                <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/search"><Search className="mr-2 h-4 w-4" />Find a ride</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/post-ride"><Plus className="mr-2 h-4 w-4" />Post a ride</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/live-map"><MapPin className="mr-2 h-4 w-4" />Live map</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/sos"><AlertTriangle className="mr-2 h-4 w-4 text-red-600" />SOS</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/rides-log">Log</Link>
              </Button>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon"><UserIcon className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" />Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <SettingsIcon className="mr-2 h-4 w-4" />Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild className="brand-gradient text-white hover:opacity-95">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/search" })}>Find a ride</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/post-ride" })}>Post a ride</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/live-map" })}>Live map</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/sos" })}>SOS alerts</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
