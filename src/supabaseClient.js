import { createClient } from "@supabase/supabase-js";

const cfg = window.APP_CONFIG || {};

if (!cfg.supabaseUrl || cfg.supabaseUrl.includes("YOUR-PROJECT-REF")) {
  // eslint-disable-next-line no-console
  console.warn(
    "Aqualec Job Tracker: Supabase is not configured yet. Edit public/config.js with your project URL and anon key."
  );
}

export const supabase = createClient(
  cfg.supabaseUrl || "https://placeholder.supabase.co",
  cfg.supabaseAnonKey || "placeholder-key"
);
