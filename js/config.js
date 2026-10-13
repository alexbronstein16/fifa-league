export const SUPABASE_URL = "https://elmktiaxqplepmjypfdy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbWt0aWF4cXBsZXBtanlwZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTUwMDAsImV4cCI6MjEwNzMzMTAwMH0.tLmfWzcQEkE4jKQWmz2Wiwf9YLNgZPv5u3_O6ro-s_c";


// The shared league account
export const REPORT_EMAIL = "alexbro1622@gmail.com";
export const ADMIN_ID = "99247e39-ccae-4ae0-a3e3-364982c8db5f";

// Starter autocomplete list. Clubs people actually use get added automatically
// and float to the top, so this only matters for the first few games.
export const CLUB_SUGGESTIONS = [
  "Real Madrid", "Barcelona", "Manchester City", "Liverpool", "Arsenal",
  "Bayern Munich", "Paris Saint-Germain", "Inter", "AC Milan", "Juventus",
  "Chelsea", "Manchester United", "Tottenham", "Atletico Madrid",
  "Borussia Dortmund", "Newcastle", "Aston Villa", "Napoli",
];

// Nicknames people type, mapped to the club name used in stats.
// Typing an alias finds the club, and leaving the box snaps it to the full name.
export const CLUB_ALIASES = {
  "PSG": "Paris Saint-Germain",
  "Man City": "Manchester City",
  "Man Utd": "Manchester United",
  "Man United": "Manchester United",
  "Spurs": "Tottenham",
  "Barca": "Barcelona",
  "Atleti": "Atletico Madrid",
  "Inter Milan": "Inter",
  "Bayern": "Bayern Munich",
  "Dortmund": "Borussia Dortmund",
  "BVB": "Borussia Dortmund",
  "Juve": "Juventus",
  "Milan": "AC Milan",
  "Villa": "Aston Villa",
};

export const LEAGUE = {
  name: "FIFA League",
  season: 1,
  points: { win: 3, draw: 1, loss: 0 },
  playoffSpots: 4,
  legs: 2,        // times each pair plays in the league (2 = home and away)
  elo: { start: 1500, k: 32, kPlayoff: 40, kFriendly: 16 },
};
