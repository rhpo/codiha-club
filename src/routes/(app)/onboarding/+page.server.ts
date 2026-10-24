import { fail, redirect } from "@sveltejs/kit";
import { missingProfileFields, profileComplete } from "$lib/profile.js";
import { needsFacePhoto } from "$lib/roles.js";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await locals.getUser();
  if (!user) throw redirect(303, "/login?next=/onboarding");

  const profile = await locals.getProfile();
  if (
    profile &&
    profileComplete(profile) &&
    url.searchParams.get("edit") !== "1"
  ) {
    throw redirect(
      303,
      profile.status === "approved" ? "/dashboard" : "/pending"
    );
  }

  return {
    profile,
    email: user.email ?? null,
    missing: missingProfileFields(profile),
    // Drives the button: "Next" when the face photo still has to be taken,
    // "Save changes" when this is just an edit.
    photoPending: !profile || needsFacePhoto(profile),
    next: url.searchParams.get("next") ?? "/dashboard",
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = await locals.getUser();
    if (!user) throw redirect(303, "/login");

    const profileBefore = await locals.getProfile();
    const form = await request.formData();
    const str = (k: string) => String(form.get(k) ?? "").trim();

    const full_name = str("full_name");
    const university = str("university");
    const field = str("field");
    const year = str("year");

    const values = {
      full_name,
      university,
      field,
      year,
      discord: str("discord") || null,
      phone: str("phone") || null,
      github: str("github") || null,
      linkedin: str("linkedin") || null,
      bio: str("bio") || null,
    };

    if (full_name.length < 3)
      return fail(400, { error: "Please enter your full name.", values });
    if (!university)
      return fail(400, { error: "Please pick your university.", values });
    if (!field)
      return fail(400, { error: "Please pick your field of study.", values });
    if (!year)
      return fail(400, { error: "Please pick your current year.", values });
    if (values.bio === null || values.bio.length < 10) {
      return fail(400, {
        error: "Tell us in a sentence or two why you joined.",
        values,
      });
    }

    // upsert, not update: an UPDATE matching zero rows is NOT an error in
    // PostgREST, so a member with no profile row (signed up before the
    // on_auth_user_created trigger existed, or the trigger failed) used to
    // bounce between /onboarding, /pending and /login forever with no
    // message. The insert path is allowed by profiles_insert_own, and role
    // and status keep their table defaults of 'member' and 'pending'.
    const { data: saved, error } = await locals.supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          // No picture is accepted here. The only way to set one is the face
          // step, which checks it; this just keeps whatever is already stored,
          // falling back to the picture the OAuth provider gave us so the nav
          // has something to show in the meantime. It never counts as verified.
          avatar_url:
            profileBefore?.avatar_url ??
            user.user_metadata?.avatar_url ??
            user.user_metadata?.picture ??
            null,
          ...values,
          onboarded_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("status,role,avatar_face_verified")
      .maybeSingle();

    if (error) return fail(500, { error: error.message, values });
    if (!saved) {
      return fail(500, {
        error:
          "Your profile could not be saved. Please try again, or contact the club board.",
        values,
      });
    }

    const next = String(form.get("next") ?? "/dashboard");
    const safeNext = next.startsWith("/") ? next : "/dashboard";

    // The details are only half of it. Anyone who still owes a face photo
    // goes straight to that step, which is what finally submits them.
    if (needsFacePhoto(saved)) {
      throw redirect(303, `/photo?next=${encodeURIComponent(safeNext)}`);
    }

    if (saved.status !== "approved") throw redirect(303, "/pending");
    throw redirect(303, safeNext);
  },
};
