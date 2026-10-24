import { fail, redirect } from "@sveltejs/kit";
import { requireOnboarded } from "$lib/server/guards";
import { uploadAvatar } from "$lib/server/upload";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";
import { needsFacePhoto } from "$lib/roles.js";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  // Not requireMember: this step sits before approval, so a member who is
  // still pending review has to be able to reach it.
  const profile = await requireOnboarded(event);

  // ?change=1 is how somebody replaces a picture they already had verified.
  // Without it, a member who is already sorted has no reason to be here.
  const changing = event.url.searchParams.get("change") === "1";
  const next = event.url.searchParams.get("next") ?? "/dashboard";
  if (!needsFacePhoto(profile) && !changing) {
    throw redirect(303, next);
  }

  return {
    profile,
    changing,
    // Somebody who has not been reviewed yet is still finishing signing up,
    // so for them this is the last step rather than a detour.
    finishingSignup:
      !profile.avatar_face_verified && profile.status !== "approved",
    // Always a way out of this step. Mid-signup that means back to the
    // details form, with the values they already entered still there; when
    // only swapping a picture it means give up and go back where they were.
    photoBackHref: changing
      ? next
      : `/onboarding?edit=1&next=${encodeURIComponent(next)}`,
    next,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const profile = await requireOnboarded(event);
    const form = await event.request.formData();

    // What the browser's detector found. Not trustworthy on its own - it only
    // ever sets a flag, and never grants access to anything.
    const detected = String(form.get("face_detected") ?? "") === "1";

    // Passing the check is the only route to a verified photo: nobody,
    // including an admin, can mark one acceptable by hand. A photo that did
    // not pass is refused here rather than stored awaiting a review that can
    // never happen.
    if (!detected) {
      return fail(400, {
        error:
          "That photo did not pass the face check. Try another one, or use your camera in better light.",
      });
    }

    let url: string | null = null;
    try {
      url = await uploadAvatar(form.get("avatar"), profile.id);
    } catch (e) {
      return fail(400, {
        error: e instanceof Error ? e.message : "Upload failed",
      });
    }
    if (!url) return fail(400, { error: "Choose a photo first." });

    // avatar_face_verified is write-protected against members by the
    // profiles_protect trigger, so this has to go through the service role.
    const { error } = await supabaseAdmin()
      .from("profiles")
      .update({
        avatar_url: url,
        avatar_face_verified: detected,
        avatar_verified_at: detected ? new Date().toISOString() : null,
      })
      .eq("id", profile.id);

    if (error) return fail(500, { error: error.message });

    // A member who had not been reviewed yet has now finished signing up.
    if (profile.status !== "approved") throw redirect(303, "/pending");

    const next = String(form.get("next") ?? "/dashboard");
    throw redirect(303, next.startsWith("/") ? next : "/dashboard");
  },
};
