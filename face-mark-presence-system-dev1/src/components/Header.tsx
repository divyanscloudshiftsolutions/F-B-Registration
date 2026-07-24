import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Calendar, User, Clock, LogOut, Clock4, Plane, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const { user, logout } = useAuth();
  // console.log("user", user);
  const location = useLocation();

  // Get initials from user name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header className={cn("border-b bg-white", className)}>
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Clock4 className="h-6 w-6 text-attendance-primary" />
          <Link to="/" className="font-semibold text-lg">
            Present Sir
          </Link>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/dashboard"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === "/dashboard"
                    ? "text-attendance-primary"
                    : "text-muted-foreground"
                )}
              >
                <Clock className="h-4 w-4 inline mr-1" />
                Dashboard
              </Link>
              <Link
                to="/history"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === "/history"
                    ? "text-attendance-primary"
                    : "text-muted-foreground"
                )}
              >
                <Calendar className="h-4 w-4 inline mr-1" />
                History
              </Link>
              <Link
                to="/leave"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === "/leave"
                    ? "text-attendance-primary"
                    : "text-muted-foreground"
                )}
              >
                <Plane className="h-4 w-4 inline mr-1" />
                Leave
              </Link>
              <Link
                to="/payslips"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === "/payslips"
                    ? "text-attendance-primary"
                    : "text-muted-foreground"
                )}
              >
                <Wallet className="h-4 w-4 inline mr-1" />
                Payslips
              </Link>
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="outline-none">
                  <Avatar className="h-9 w-9 ">
                    <AvatarImage
                      src={resolveMediaUrl(user.userImage)}
                      alt={user.userImage}
                      className="object-contain"
                    />
                    <AvatarFallback className="bg-attendance-primary text-white">
                      {getInitials(user.userName)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/leave" className="cursor-pointer">
                    <Plane className="mr-2 h-4 w-4" />
                    Leave
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/payslips" className="cursor-pointer">
                    <Wallet className="mr-2 h-4 w-4" />
                    Payslips
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">
                    <Clock className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history" className="cursor-pointer">
                    <Calendar className="mr-2 h-4 w-4" />
                    Attendance History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
