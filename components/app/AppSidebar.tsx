"use client";

import {
  Search,
  Train,
  Map,
  Compass,
  Clock,
  Ticket,
  Calendar,
  Bell,
  Settings,
  ChevronLeft,
  MessageSquare,
  TrainFront,
} from "lucide-react";

export type AppSection =
  | "search"
  | "bookings"
  | "trains"
  | "coach"
  | "journey"
  | "pnr"
  | "planner"
  | "notifications"
  | "settings";

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: "search", label: "AI Search", icon: Search },
  { id: "trains", label: "Trains", icon: Train },
  { id: "coach", label: "Coach View", icon: Map },
  { id: "journey", label: "Journey", icon: Compass },
  { id: "bookings", label: "Bookings", icon: Ticket },
  { id: "pnr", label: "PNR Status", icon: Clock },
  { id: "planner", label: "Travel Plan", icon: Calendar },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AppSidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onToggleCollapse,
  unreadNotifications,
}: {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  unreadNotifications: number;
}) {
  return (
    <aside
      className={`flex flex-col border-r-2 border-[var(--fg)] bg-[var(--bg)] transition-all duration-300 ease-in-out ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Brand */}
      <div
        className={`flex items-center border-b-2 border-[var(--fg)] px-4 h-[60px] flex-shrink-0 ${
          collapsed ? "justify-center" : "gap-3"
        }`}
      >          <TrainFront className="h-5 w-5 text-[var(--railway-red)] flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-sm tracking-[0.15em] uppercase whitespace-nowrap">
            RAILY
          </span>
        )}
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4 space-y-1 app-scroll">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-[0.1em] transition-all duration-150 border-l-2 ${
                isActive
                  ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)] font-semibold"
                  : "text-[var(--fg)] border-transparent hover:bg-[var(--fg)]/5 hover:border-[var(--fg)]/30"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title={item.label}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-4 w-4" />
                {item.id === "notifications" && unreadNotifications > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--railway-red)] text-[var(--bg)] text-[8px] flex items-center justify-center font-bold">
                    {unreadNotifications}
                  </span>
                )}
              </div>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* AI Assistant toggle (collapsed only) */}
      <div className="border-t-2 border-[var(--fg)] p-2 flex flex-col gap-1">
        <button
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.1em] bg-[var(--railway-red)] text-[var(--bg)] hover:bg-[var(--fg)] transition-colors duration-150"
          title="AI Assistant"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center px-3 py-2 text-[var(--muted)] hover:text-[var(--fg)] transition-colors duration-150"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
