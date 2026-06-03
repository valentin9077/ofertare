"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) router.replace("/");
      else setReady(true);
    })();
  }, [router]);

  if (!ready)
    return (
      <div className="shell flex items-center justify-center text-muted">Se încarcă…</div>
    );

  return (
    <div className="shell flex flex-col">
      <div className="flex-1 pb-2">{children}</div>
      <BottomNav />
    </div>
  );
}
