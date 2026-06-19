"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFB] dark:bg-[#0f1923] text-[#6B8299] dark:text-[#9BB0C1]">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  // key={user.uid} forces a full remount of all child components (including
  // the dashboard) whenever the signed-in identity changes. This guarantees
  // no stale state from a previous user session can leak through.
  return <div key={user.uid} className="contents">{children}</div>;
}
