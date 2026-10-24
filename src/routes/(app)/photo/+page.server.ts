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

    // The browser reports what its detector found. It is not trustworthy on
    // its own, which is why it only ever sets a flag an admin can review,
    // never grants access to anything.
    const detected = String(form.get("face_detected") ?? "") === "1";
    // Set only when the detector could not run at all. Without this, a
    // browser that cannot load the model would lock the member out for good.
    const unavailable = String(form.get("face_unavailable") ?? "") === "1";

    if (!detected && !unavailable) {
      return fail(400, {
        error:
          "That photo does not show a face clearly enough. Please try another one.",
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

    if (!detected) {
      return {
        success:
          "Photo saved. The automatic face check could not run, so an admin will confirm it.",
      };
    }

    // A member who had not been reviewed yet has now finished signing up.
    if (profile.status !== "approved") throw redirect(303, "/pending");

    const next = String(form.get("next") ?? "/dashboard");
    throw redirect(303, next.startsWith("/") ? next : "/dashboard");
  },
};
