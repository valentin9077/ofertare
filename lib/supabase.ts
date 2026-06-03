import { createBrowserClient } from "@supabase/ssr";

// Valorile publice (publishable) sunt sigure în client. Pot fi suprascrise din env (Vercel).
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dycehbzijkbtqcooxecz.supabase.co";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_mMPqsEmVncpt-ltlSD5LRg_2EqWiliV";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function supabase() {
  if (!_client) _client = createBrowserClient(URL, KEY);
  return _client;
}
