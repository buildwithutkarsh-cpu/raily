"use client";

import { useState } from "react";
import {
  Bell,
  Train,
  Clock,
  AlertCircle,
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

const sampleNotifications: Notification[] = [
  {
    id: "1",
    type: "delay",
    title: "Train Delay Alert",
    message: "Rajdhani Express (12951) is running 15 min late. New ETA: 12:05 PM",
    time: "5 min ago",
    read: false,
    actionable: true,
  },
  {
    id: "2",
    type: "booking",
    title: "Booking Confirmed",
    message: "Your booking for Shatabdi Express (12009) on 30 Jul is confirmed. PNR: 8651274390",
    time: "2 hours ago",
    read: false,
    actionable: true,
  },
  {
    id: "3",
    type: "platform",
    title: "Platform Change",
    message: "Rajdhani Express (12951) platform changed from 2 to 3. Please proceed to Platform 3.",
    time: "3 hours ago",
    read: true,
    actionable: false,
  },
  {
    id: "4",
    type: "food",
    title: "Food Delivery Update",
    message: "Your pre-order for Breakfast (Masala Dosa & Coffee) will be served at 08:30 AM.",
    time: "5 hours ago",
    read: true,
    actionable: true,
  },
  {
    id: "5",
    type: "general",
    title: "Price Drop Alert",
    message: "Garib Rath (12215) Delhi → Jaipur now available at ₹740 (was ₹890)",
    time: "1 day ago",
    read: true,
    actionable: false,
  },
  {
    id: "6",
    type: "booking",
    title: "Booking Reminder",
    message: "Your journey Delhi → Jaipur is tomorrow. Check-in opens at 04:25 AM.",
    time: "1 day ago",
    read: true,
    actionable: true,
  },
];

const typeConfig: Record<string, { icon: React.ElementType; className: string }> = {
  delay: { icon: Clock, className: "bg-[var(--fg)] text-[var(--bg)]" },
  booking: { icon: CheckCircle, className: "bg-[var(--railway-red)] text-[var(--bg)]" },
  platform: { icon: Info, className: "bg-[var(--fg)] text-[var(--bg)]" },
  food: { icon: Train, className: "bg-[var(--fg)] text-[var(--bg)]" },
  general: { icon: Bell, className: "border-2 border-[var(--fg)] text-[var(--fg)]" },
};

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState(sampleNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Notifications
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] uppercase tracking-[0.1em] text-[var(--railway-red)] hover:underline"
          >
            Mark all read
          </button>
        )}
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
          <div className="border-2 border-[var(--fg)] p-8 text-center">
            <Bell className="h-8 w-8 mx-auto mb-3 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)]">All caught up!</p>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              No {filter === "unread" ? "unread " : ""}notifications
            </p>
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
              onClick={() => markAsRead(notification.id)}
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
