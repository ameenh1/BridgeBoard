import { createClient } from "@supabase/supabase-js";
import { ensureSupabaseAssetBucket } from "@/lib/assets/supabaseAssetCache";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await ensureSupabaseAssetBucket(client);
console.log("Verified private BridgeBoard asset bucket.");
