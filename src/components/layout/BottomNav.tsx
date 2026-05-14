"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Review", Icon: Home },
  { href: "/words", label: "Words", Icon: BookOpen },
  { href: "/add", label: "Add", Icon: Plus },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pt-1">
        {links.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname === ""
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-emerald-400")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
