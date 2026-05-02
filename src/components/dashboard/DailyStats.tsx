"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface UserStats {
  display_name: string;
  reviewed_today: number;
}

export function DailyStats() {
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all profiles first
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("user_id, display_name");

      if (pError || !profiles) {
        setLoading(false);
        return;
      }

      // Count reviews today per user
      const startOfDayStr = today.toISOString();
      const st = await Promise.all(
        profiles.map(async (p) => {
          const { count } = await supabase
            .from("card_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", p.user_id)
            .gte("last_review", startOfDayStr);

          return {
            display_name: p.display_name,
            reviewed_today: count || 0,
          };
        })
      );

      setStats(st);
      setLoading(false);
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Today's Reviews</CardTitle>
          <CardDescription>Cards reviewed since midnight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around gap-4">
            <Skeleton className="h-24 w-1/2" />
            <Skeleton className="h-24 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle>Today's Reviews</CardTitle>
        <CardDescription>Cards reviewed since midnight</CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="flex divide-x divide-border overflow-hidden rounded-xl border border-border/50 bg-background/50">
            {stats.map((user, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <div className="text-4xl font-bold tracking-tighter text-emerald-400 mb-1">
                  {user.reviewed_today}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {user.display_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
