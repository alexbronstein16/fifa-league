import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEAGUE } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getTeams() {
  const { data, error } = await supabase
    .from("teams").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data;
}

export async function getMatches(season = LEAGUE.season) {
  const { data, error } = await supabase
    .from("matches").select("*").eq("season", season).order("played_at");
  if (error) throw error;
  return data;
}
