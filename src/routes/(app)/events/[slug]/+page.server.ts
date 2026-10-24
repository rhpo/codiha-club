import { error, fail, redirect } from "@sveltejs/kit";
import { marked } from "marked";
import { notifyEventRegistered } from "$lib/server/notify";
import { loadTheme } from "$lib/server/settings";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const sb = locals.supabase;
  const profile = await locals.getProfile();

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!event) throw error(404, "Event not found");

  const [{ count: registeredCount }, myReg, myAttendance] = await Promise.all([
    sb
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "registered"),
    profile
      ? sb
          .from("event_registrations")
          .select("*")
          .eq("event_id", event.id)
          .eq("member_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile
      ? sb
          .from("event_attendance")
          .select("checked_in_at")
          .eq("event_id", event.id)
          .eq("member_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    event,
    descriptionHtml: event.description ? await marked(event.description) : null,
    registeredCount: registeredCount ?? 0,
    myRegistration: myReg.data ?? null,
    myAttendance: myAttendance.data ?? null,
  };
};

export const actions: Actions = {
  register: async ({ params, locals, url }) => {
    const profile = await locals.getProfile();
    if (!profile)
      throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
    if (!profile.onboarded_at) throw redirect(303, "/onboarding");
    if (profile.status !== "approved") throw redirect(303, "/pending");

    const sb = locals.supabase;
    // title/starts_at/location are only read so the confirmation mail can
    // say something useful instead of "you are registered".
    const { data: event } = await sb
      .from("events")
      .select("id,capacity,status,ends_at,title,slug,starts_at,location")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!event) return fail(404, { error: "Event not found" });
    if (event.status !== "published")
      return fail(400, { error: "This event is not open yet." });
    if (new Date(event.ends_at).getTime() < Date.now()) {
      return fail(400, { error: "This event has already finished." });
    }

    // capacity decides registered vs waitlist
    let status = "registered";
    if (event.capacity) {
      const { count } = await sb
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "registered");
      if ((count ?? 0) >= event.capacity) status = "waitlist";
    }

    const { error: insertError } = await sb
      .from("event_registrations")
      .upsert(
        { event_id: event.id, member_id: profile.id, status },
        { onConflict: "event_id,member_id" }
      );

    if (insertError) return fail(400, { error: insertError.message });

    // Only a confirmed place is worth an email. A waitlist entry is not news
    // yet, and would mean a second mail when it turns into a place.
    if (status === "registered") {
      await notifyEventRegistered(profile, event, {
        origin: url.origin,
        theme: await loadTheme(sb),
      });
    }
    return { success: status === "waitlist" ? "waitlist" : "registered" };
  },

  cancel: async ({ params, locals }) => {
    const profile = await locals.getProfile();
    if (!profile) throw redirect(303, "/login");

    const sb = locals.supabase;
    const { data: event } = await sb
      .from("events")
      .select("id")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!event) return fail(404, { error: "Event not found" });

    const { error: delError } = await sb
      .from("event_registrations")
      .delete()
      .eq("event_id", event.id)
      .eq("member_id", profile.id);

    if (delError) return fail(400, { error: delError.message });
    return { success: "cancelled" };
  },
};
