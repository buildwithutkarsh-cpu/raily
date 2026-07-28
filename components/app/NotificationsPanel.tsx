"use client";

import { useState } from "react";
import {
  Bell,
  Train,
  Clock,
  CheckCircle,
  Info,
  ArrowRight,
} from "lucide-react";

interface Notification {
  id: string;
  type: "delay" | "booking" | "platform" | "food" | "general";
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionable: boolean;
}

const typeConfig: Record<string, { icon: React.ElementType; className: string }> = {
  delay: { icon: Clock, className: "bg-[var(--fg)] text-[var(--bg)]" },
  booking: { icon: CheckCircle, className: "bg-[var(--railway-red)] text-[var(--bg)]" },
  platform: { icon: Info, className: "bg-[var(--fg)] text-[var(--bg)]" },
  food: { icon: Train, className: "bg-[var(--fg)] text-[var(--bg)]" },
  general: { icon: Bell, className: "border-2 border-[var(--fg)] text-[var(--fg)]" },
};

export default function NotificationsPanel() {
  const [notifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Notifications
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {notifications.length === 0
              ? "No alerts yet"
              : `${unreadCount} unread alert${unreadCount !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs uppercase tracking-[0.1em] border-2 transition-colors ${
              filter === f
                ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                : "border-[var(--fg)] hover:bg-[var(--fg)]/5"
            }`}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-2 text-[10px]">({unreadCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="border-2 border-[var(--fg)] p-10 text-center">
            <Bell className="h-10 w-10 mx-auto mb-4 text-[var(--muted)]" />
            <h3 className="text-base font-bold uppercase tracking-[0.03em] mb-2">
              All quiet here
            </h3>
            <p className="text-[13px] text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
              Notifications about your bookings, train delays, platform
              changes, and price drops will appear here once you book
              your first journey.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[
                { icon: Clock, text: "Delay alerts" },
                { icon: CheckCircle, text: "Booking confirmations" },
                { icon: Info, text: "Platform changes" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.text}
                    className="flex items-center gap-2 px-3 py-2 border border-[var(--fg)]/20 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]"
                  >
                    <Icon className="h-3 w-3" />
                    {item.text}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {filtered.map((notification) => {
          const config = typeConfig[notification.type];
          const Icon = config.icon;

          return (
            <div
              key={notification.id}
              className={`border-2 ${
                notification.read ? "border-[var(--fg)]/30" : "border-[var(--fg)]"
              } p-4 transition-colors ${
                !notification.read ? "bg-[var(--fg)]/[0.02]" : ""
              }`}
            >
              <div className="flex gap-4">
                <div
                  className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                    config.className
                  } ${notification.read ? "opacity-50" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold">{notification.title}</span>
                      {!notification.read && (
                        <span className="ml-2 inline-block w-2 h-2 bg-[var(--railway-red)] rounded-full" />
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--muted)] whitespace-nowrap">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--muted)] mt-1">
                    {notification.message}
                  </p>
                  {notification.actionable && (
                    <button className="mt-2 text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--fg)] hover:text-[var(--railway-red)] transition-colors flex items-center gap-1">
                      View details <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
