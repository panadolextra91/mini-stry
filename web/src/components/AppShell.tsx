import { NavLink, Outlet } from "react-router-dom";
import { DemoContextSelector } from "./DemoContextSelector";
import { Shield, GitPullRequest, Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/policies", label: "Policy Portal", icon: Shield },
  { path: "/requests", label: "Request Center", icon: GitPullRequest },
  { path: "/inbox", label: "Personal Inbox", icon: Inbox },
  { path: "/governance", label: "Governance", icon: Settings },
];

export function AppShell() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <nav className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <DemoContextSelector />
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-2">Modules</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
      <main className="flex-1 overflow-hidden bg-background">
        <Outlet />
      </main>
    </div>
  );
}
