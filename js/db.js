import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEAGUE } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- reads (public) ----------

// League members only: home, standings, playoffs
export async function getTeams() {
  const { data, error } = await supabase
    .from("teams").select("*")
    .eq("active", true).eq("in_league", true)
    .order("name");
  if (error) throw error;
  return data;
}

// Everyone, including casual players: friendlies, Elo, report, admin
export async function getAllTeams() {
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

export async function getAllMatches() {
  const { data, error } = await supabase
    .from("matches").select("*").order("played_at").order("id");
  if (error) throw error;
  return data;
}

// ---------- auth (admin and league logins) ----------

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ---------- reporting (league login) ----------

export async function submitScore(sub) {
  const { error } = await supabase.from("submissions").insert(sub);
  if (error) throw error;
}

// ---------- admin (your login) ----------

export async function addMatch(match) {
  const { error } = await supabase
    .from("matches").insert({ ...match, season: LEAGUE.season });
  if (error) throw error;
}

export async function deleteMatch(id) {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

export async function getPendingSubmissions() {
  const { data, error } = await supabase
    .from("submissions").select("*")
    .eq("status", "pending").order("created_at");
  if (error) throw error;
  return data;
}

export async function approveSubmission(id) {
  const { error } = await supabase.rpc("approve_submission", { p_id: id });
  if (error) throw error;
}

export async function rejectSubmission(id) {
  const { error } = await supabase
    .from("submissions").update({ status: "rejected" })
    .eq("id", id).eq("status", "pending");
  if (error) throw error;
}

export async function addPlayer(player) {
  const { error } = await supabase
    .from("teams").insert({ ...player, in_league: false });
  if (error) throw error;
}

// Everything, for the admin backup download (admin login can read all rows)
export async function getBackup() {
  const read = async table => {
    const { data, error } = await supabase.from(table).select("*").order("id");
    if (error) throw error;
    return data;
  };
  const [teams, matches, submissions] =
    await Promise.all([read("teams"), read("matches"), read("submissions")]);
  return { exported_at: new Date().toISOString(), teams, matches, submissions };
}
