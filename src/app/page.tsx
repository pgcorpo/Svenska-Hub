"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { RecentlyAdded } from "@/components/dashboard/RecentlyAdded";
import { DailyStats } from "@/components/dashboard/DailyStats";
import { LogOut } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("there");
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initDashboard() {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure profile exists or get name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setUserName(profile.display_name);
      } else {
        setUserName(user.email?.split("@")[0] || "there");
      }

      // Count due cards
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("card_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("due_date", now);

      setDueCount(count || 0);
      setLoading(false);
    }

    initDashboard();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Next.js app router layout hides hydration mismatch but causes an ugly flash
  // This simplistic approach holds UI until auth validates.
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Välkommen, {userName}!</h1>
          <p className="text-muted-foreground mt-1">Ready for some Swedish?</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/add")}>
            Add Words
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="space-y-8">
        {/* Main CTA */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl ${dueCount && dueCount > 0 ? "bg-blue-500/10" : "bg-emerald-500/10"}`}>
              {dueCount && dueCount > 0 ? "📚" : "🎉"}
            </div>
            
            <h2 className="mb-2 text-2xl font-bold">
              {dueCount === null 
                ? "Loading..."
                : dueCount > 0 
                  ? `${dueCount} cards due`
                  : "All caught up!"}
            </h2>
            
            <p className="mb-6 text-muted-foreground max-w-sm">
              {dueCount && dueCount > 0
                ? "You have vocabulary words waiting to be reviewed."
                : "You've finished all your reviews for now. Take a break!"}
            </p>

            <Button 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px]"
              onClick={() => router.push("/review")}
              disabled={dueCount === 0 || dueCount === null}
            >
              Start Review
            </Button>
          </div>
        </div>

        {/* Daily Stats Grid */}
        <DailyStats />

        {/* Live Feed */}
        <RecentlyAdded />
      </div>
    </div>
  );
}
