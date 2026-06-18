import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalFrameProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: string;
};

type ModalRequest = {
  title: string;
  description?: string;
  footer?: ReactNode | ((controls: { closeModal: () => void }) => ReactNode);
  className?: string;
  maxWidth?: string;
  render: (controls: { closeModal: () => void }) => ReactNode;
};

type ModalContextValue = {
  openModal: (request: ModalRequest) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ModalRequest | null>(null);

  const closeModal = useCallback(() => {
    setRequest(null);
  }, []);

  const openModal = useCallback((nextRequest: ModalRequest) => {
    setRequest(nextRequest);
  }, []);

  const value = useMemo<ModalContextValue>(() => ({ openModal, closeModal }), [closeModal, openModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {request ? (
        <Modal
          open
          title={request.title}
          description={request.description}
          onClose={closeModal}
          className={request.className}
          maxWidth={request.maxWidth}
          footer={typeof request.footer === "function" ? request.footer({ closeModal }) : request.footer}
        >
          {request.render({ closeModal })}
        </Modal>
      ) : null}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const value = useContext(ModalContext);
  if (!value) {
    throw new Error("useModal must be used inside ModalProvider");
  }
  return value;
}

export function Modal({ open, title, description, onClose, children, footer, className, maxWidth = "max-w-md" }: ModalFrameProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    setEntered(false);
    const timeout = window.setTimeout(() => setMounted(false), 250);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted) {
      return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <button
        type="button"
        aria-label="Close modal"
        className={cn("absolute inset-0 z-0 transition-opacity duration-300", entered ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <Card className={cn("relative z-10 w-full overflow-hidden shadow-2xl transition-transform duration-300 ease-out", maxWidth, className, entered ? "translate-y-0" : "-translate-y-2")}>
        <CardHeader className="items-start gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 p-5">{children}</CardContent>
        {footer ? <div className="border-t border-slate-200 bg-white px-5 py-4">{footer}</div> : null}
      </Card>
    </div>
  );
}
