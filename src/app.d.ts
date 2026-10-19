import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Profile } from '$lib/types';
import type { Theme } from '$lib/theme';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			getSession(): Promise<Session | null>;
			getUser(): Promise<User | null>;
			getProfile(): Promise<Profile | null>;
			getTheme(): Promise<Theme>;
		}
		interface PageData {
			session: Session | null;
			profile: Profile | null;
			theme: Theme;
		}
	}
}

export {};
