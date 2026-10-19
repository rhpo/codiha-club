import {
  faCircleCheck,
  faCircleExclamation,
  faMessage,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { writable } from "svelte/store";

export const menuOpen = writable(false);

/**
 * Shows the global loading screen. A counter, not a boolean, so two things
 * running at once cannot switch it off for each other.
 */
export const busyCount = writable(0);

export function startBusy() {
  busyCount.update((n) => n + 1);
}

export function endBusy() {
  busyCount.update((n) => Math.max(0, n - 1));
}

export function resetBusy() {
  busyCount.set(0);
}

export const dialogOptions = writable({
  message: "",
  title: "",
  icon: faMessage,
  variant: "info",
  open: false,
});

const PRESET = {
  ok: { title: "Done", icon: faCircleCheck },
  bad: { title: "Something went wrong", icon: faCircleExclamation },
  warn: { title: "Heads up", icon: faTriangleExclamation },
  info: { title: "Notice", icon: faMessage },
};

/**
 * Pop the shared modal. Used for every form result in the app, so feedback
 * looks the same whether it came from onboarding, an admin action or a vote.
 *
 * @param {string} message
 * @param {'ok'|'bad'|'warn'|'info'} [variant]
 * @param {string} [title] overrides the variant's default heading
 */
export function notify(message, variant = "info", title) {
  const preset = PRESET[variant] ?? PRESET.info;
  dialogOptions.set({
    message: String(message ?? ""),
    title: title ?? preset.title,
    icon: preset.icon,
    variant,
    open: true,
  });
}
