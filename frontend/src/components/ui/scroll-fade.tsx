import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrollFadeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  contentClassName?: string;
};

export function ScrollFade({ children, className, contentClassName, ...props }: ScrollFadeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFades = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    setShowTopFade(element.scrollTop > 1);
    setShowBottomFade(element.scrollTop < maxScrollTop - 1);
  }, []);

  useEffect(() => {
    updateFades();

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateFades);
    resizeObserver.observe(element);

    for (const child of Array.from(element.children)) {
      resizeObserver.observe(child);
    }

    window.addEventListener("resize", updateFades);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFades);
    };
  }, [children, updateFades]);

  return (
    <div className={cn("relative min-h-0 overflow-hidden", className)} {...props}>
      <div ref={scrollRef} className={cn("h-full overflow-auto", contentClassName)} onScroll={updateFades}>
        {children}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 h-8 bg-gradient-to-b from-white to-white/0 transition-opacity duration-150",
          showTopFade ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-white to-white/0 transition-opacity duration-150",
          showBottomFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

