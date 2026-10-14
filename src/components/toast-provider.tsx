"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  message: string;
  action?: ToastAction;
  /** ms before auto-dismiss; 0 disables it. Default matches spec 13.7's "~5s" tosts. */
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

/**
 * A minimal, dependency-free toast (spec mockup 22's "tosti"): a dark pill, bottom-right, that
 * announces the result of an action (posted / archived / restored) and disappears on its own.
 * No sonner/radix-toast — the stack has no toast library, so this is built from the primitives
 * already in use elsewhere (a fixed-position portal + Tailwind tokens).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { ...options, id }]);
      const duration = options.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  const t = useTranslations("toast");
  const [mounted, setMounted] = useState(false);
  // Avoids a server/client markup mismatch: createPortal needs document.body, which only
  // exists on the client.
  useState(() => {
    if (typeof document !== "undefined") setMounted(true);
  });
  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2 sm:bottom-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg",
            "animate-in fade-in slide-in-from-bottom-2",
          )}
        >
          <Check className="size-4 shrink-0" />
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="font-semibold underline-offset-2 hover:underline"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => onDismiss(toast.id)}
            className="text-primary-foreground/70 hover:text-primary-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
