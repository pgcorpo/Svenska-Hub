"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { VocabularyWord, Profile } from "@/types";

interface RecentItem extends VocabularyWord {
  profiles: Pick<Profile, "display_name"> | null;
}

export function RecentlyAdded() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("vocabulary")
        .select(`
          *,
          profiles(display_name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setItems(data as unknown as RecentItem[]);
      }
      setLoading(false);
    }

    fetchRecent();

    // Set up realtime subscription for new words
    const supabase = createClient();
    const channel = supabase.channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vocabulary" },
        () => {
          // Simplest approach: refetch
          fetchRecent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Recently Added</CardTitle>
          <CardDescription>Latest sticky notes scanned</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle>Recently Added</CardTitle>
        <CardDescription>Latest sticky notes scanned</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No words added yet. Scan a sticky note!
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {item.swedish_word}
                  </span>
                  <Badge variant="outline" className="opacity-70">
                    {item.gender !== "n/a" ? item.gender : "word"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.english_meaning}
                </div>
              </div>
              {item.profiles?.display_name && (
                <div className="text-right text-xs text-muted-foreground">
                  Added by<br />
                  <span className="font-medium">{item.profiles.display_name}</span>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
