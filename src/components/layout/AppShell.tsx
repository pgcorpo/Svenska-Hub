"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav =
    pathname === "/login" || pathname.startsWith("/auth");

  return (
    <>
      <div
        className={cn(
          "min-h-dvh bg-background",
          !hideNav && "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        )}
      >
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </>
  );
}
