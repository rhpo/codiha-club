/** Lowest to highest. Mirrors role_rank() in SQL; helpers in src/lib/roles.js. */
export type Role =
  | "member"
  | "staff"
  | "project_manager"
  | "admin"
  | "superadmin";
export type MemberStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  university: string | null;
  field: string | null;
  year: string | null;
  avatar_url: string | null;
  /** Set only by the face step, through the service role: members cannot
	    write it themselves (see the profiles_protect trigger in 0008). */
  avatar_face_verified: boolean | null;
  avatar_verified_at: string | null;
  bio: string | null;
  discord: string | null;
  github: string | null;
  linkedin: string | null;
  phone: string | null;
  role: Role;
  status: MemberStatus;
  onboarded_at: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface LeaderboardRow {
  id: string;
  full_name: string;
  university: string | null;
  field: string | null;
  year: string | null;
  avatar_url: string | null;
  points: number;
  rank: number;
  badge_count: number;
}

export interface ClubEvent {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  cover_url: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  checkin_points: number;
  status: "draft" | "published" | "cancelled" | "archived";
}

export interface Hackathon {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  summary: string | null;
  description: string | null;
  cover_url: string | null;
  location: string | null;
  prize_pool: string | null;
  starts_at: string;
  ends_at: string;
  apply_opens_at: string | null;
  apply_deadline: string | null;
  capacity: number | null;
  team_size_min: number;
  team_size_max: number;
  points_participation: number;
  points_first: number;
  points_second: number;
  points_third: number;
  status: "draft" | "published" | "closed" | "cancelled" | "archived";
}

export interface Certificate {
  id: string;
  code: string;
  member_id: string;
  kind: "participation" | "winner";
  event_id: string | null;
  hackathon_id: string | null;
  place: number | null;
  title: string;
  issued_at: string;
  revoked_at: string | null;
}
