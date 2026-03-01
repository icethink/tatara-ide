// ⚒️ Notifications — Toast notification system
//
// Shows temporary notifications (save success, errors, warnings, info)

import { useState, useCallback, useRef, useEffect } from "react";

export interface Notification {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number; // ms, 0 = persistent
  action?: { label: string; onClick: () => void };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idRef = useRef(0);

  const notify = useCallback((
    message: string,
    type: Notification["type"] = "info",
    opts?: { duration?: number; action?: Notification["action"] }
  ) => {
    const id = ++idRef.current;
    const notification: Notification = {
      id,
      message,
      type,
      duration: opts?.duration ?? 4000,
      action: opts?.action,
    };

    setNotifications((prev) => [...prev, notification]);

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, notification.duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, notify, dismiss };
}

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}

export function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 32,
      right: 16,
      zIndex: 300,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxWidth: 380,
    }}>
      {notifications.map((n) => (
        <NotificationToast key={n.id} notification={n} onDismiss={() => onDismiss(n.id)} />
      ))}
    </div>
  );
}

function NotificationToast({
  notification: n,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  };

  const icon = typeIcon(n.type);
  const borderColor = typeColor(n.type);

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 6,
      padding: "10px 14px",
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      opacity: exiting ? 0 : 1,
      transform: exiting ? "translateX(100%)" : "translateX(0)",
      transition: "opacity 0.2s, transform 0.2s",
      fontSize: 13,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "var(--fg-primary)", lineHeight: 1.4 }}>{n.message}</div>
        {n.action && (
          <button
            onClick={() => { n.action!.onClick(); handleDismiss(); }}
            style={{
              marginTop: 6,
              padding: "3px 10px",
              background: borderColor,
              color: "var(--bg-primary)",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {n.action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "var(--fg-muted)",
          cursor: "pointer",
          fontSize: 14,
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case "success": return "✅";
    case "warning": return "⚠️";
    case "error": return "❌";
    default: return "ℹ️";
  }
}

function typeColor(type: string): string {
  switch (type) {
    case "success": return "var(--success)";
    case "warning": return "var(--warning)";
    case "error": return "var(--error)";
    default: return "var(--info)";
  }
}
