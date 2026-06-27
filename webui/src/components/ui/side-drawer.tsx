import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SideDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  ariaLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  onClose: () => void;
};

export function SideDrawer({
  open,
  title,
  description,
  ariaLabel,
  children,
  footer,
  maxWidth = "max-w-[760px]",
  onClose,
}: SideDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }

    setEntered(false);
    const timeout = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer"
        className={cn(
          "absolute inset-0 z-0 bg-slate-950/30 transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0",
        )}
        type="button"
        onClick={onClose}
      />
      <aside
        aria-label={ariaLabel ?? title}
        className={cn(
          "absolute right-0 top-0 z-10 flex h-full w-full transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out",
          maxWidth,
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
          <Button aria-label="Close drawer" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

