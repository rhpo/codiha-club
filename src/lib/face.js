// @ts-nocheck
/**
 * Browser-side face detection for profile pictures.
 *
 * Uses the tiny face detector from @vladmandic/face-api, whose weights are
 * self-hosted in static/models (190 KB) rather than pulled from a CDN at
 * runtime. The library itself is imported lazily, so the ~1.5 MB bundle only
 * loads on the page that actually needs it.
 *
 * This is a usability gate, not a security control: everything here runs in
 * the member's own browser and could be bypassed by anyone determined enough.
 * The point is to stop people using a cartoon, not to defeat an attacker.
 */

const MODEL_URL = "/models";

/** Tried in order until a face turns up. See the comment in detectFace(). */
const INPUT_SIZES = [416, 608, 800];

/** Low enough for a dim phone photo, high enough that a logo is not a face. */
const SCORE_THRESHOLD = 0.35;

/**
 * How far the nose may sit from the midpoint between the eyes before the photo
 * counts as a side profile, as a fraction of the distance between the eyes.
 *
 * Face-on, the nose sits almost exactly between the eyes. Turn the head and it
 * slides towards the near eye, while the eyes themselves crowd together, so the
 * ratio grows quickly. 0.42 lets through a relaxed three-quarter angle and
 * rejects a true profile.
 */
const MAX_NOSE_OFFSET = 0.42;

/**
 * Minimum eye separation relative to the face box width. A head turned far
 * enough squashes the eyes together even when the nose still looks centred.
 */
const MIN_EYE_SPREAD = 0.2;

/**
 * Smallest the face may be, as a fraction of the image width.
 *
 * This is a framing rule, not a liveness check: a profile picture should be
 * head-and-shoulders. It also happens to reject the common cheat of holding a
 * book, phone or ID up to the camera, because the face inside the held object
 * is small within the frame. Somebody determined can still fill the frame with
 * a printed photo; nothing client-side can tell that apart from a person.
 */
const MIN_FACE_WIDTH = 0.2;

let loader = null;
let api = null;

/** Loads the library and weights once; later calls reuse the same promise. */
async function ready() {
  // Rollup evaluates import.meta.env.SSR to a literal `true` when building the
  // server bundle, which lets it drop everything below as dead code. Without
  // this guard the whole ~1.5 MB model runner is bundled into the serverless
  // function, which never reaches this path anyway.
  //
  // It throws rather than returning null so that if it ever IS reached, the
  // caller's catch turns it into reason 'unavailable' instead of a TypeError
  // on the next line.
  if (import.meta.env.SSR) throw new Error("Face detection is browser-only");

  if (!loader) {
    loader = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        // Landmarks are what make the side-profile check possible; the
        // tiny variant is 76 KB.
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      ]);
      api = faceapi;
      return faceapi;
    })().catch((e) => {
      // Reset so a transient network failure can be retried rather than
      // poisoning every later attempt.
      loader = null;
      throw e;
    });
  }
  return loader;
}

/** Start fetching the model early, e.g. when the photo page mounts. */
export function warmUp() {
  ready().catch(() => {
    /* preloading is best effort */
  });
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ok: boolean, faces: number, reason?: string}>}
 *
 * `ok: true` means exactly one face was found. Zero is a rejection; more than
 * one is too, because a group photo does not identify the member.
 */
export async function detectFace(file) {
  if (!file) return { ok: false, faces: 0, reason: "no-file" };

  let faceapi;
  try {
    faceapi = await ready();
  } catch {
    // The detector could not load at all. Refusing the upload here would
    // lock the member out over a failed asset fetch, so let it through and
    // leave the picture unverified for an admin to confirm.
    return { ok: false, faces: 0, reason: "unavailable" };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // The detector sees a square of inputSize pixels, so on a tall phone
    // photo (a 1980x3520 portrait is typical) a face can shrink below the
    // point of being detectable. Measured on a real photo from this site:
    // nothing at all at 416 or 608, found at 0.57 confidence at 800.
    //
    // So escalate rather than picking one size: a head-and-shoulders selfie
    // hits on the first pass, and only a photo with no face pays for all
    // three.
    let found = [];
    let usedSize = INPUT_SIZES[INPUT_SIZES.length - 1];
    for (const inputSize of INPUT_SIZES) {
      found = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize,
          scoreThreshold: SCORE_THRESHOLD,
        })
      );
      if (found.length) {
        usedSize = inputSize;
        break;
      }
    }

    if (found.length === 0) return { ok: false, faces: 0, reason: "no-face" };
    if (found.length > 1)
      return { ok: false, faces: found.length, reason: "many-faces" };

    const box = found[0].box;
    const frameWidth = img.naturalWidth || img.width || 0;
    if (frameWidth && box.width / frameWidth < MIN_FACE_WIDTH) {
      return { ok: false, faces: 1, reason: "too-small" };
    }

    // A detected face is not necessarily a usable one: the detector happily
    // finds a head in profile, which is no good for recognising somebody.
    const landmarks = await faceapi
      .detectSingleFace(
        img,
        // Same inputSize that found the face above. Hardcoding 416 here
        // made this return null for any photo that needed the cascade,
        // which quietly disabled the check on exactly the big phone
        // photos it is meant to catch.
        new faceapi.TinyFaceDetectorOptions({
          inputSize: usedSize,
          scoreThreshold: SCORE_THRESHOLD,
        })
      )
      .withFaceLandmarks(true);

    // No landmarks means the check could not run, not that the face is bad.
    if (!landmarks?.landmarks) return { ok: true, faces: 1 };

    if (!facingCamera(landmarks)) {
      return { ok: false, faces: 1, reason: "not-facing" };
    }

    return { ok: true, faces: 1 };
  } catch {
    return { ok: false, faces: 0, reason: "unreadable" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Whether the head is turned far enough to be unusable.
 *
 * Measured from the eye centres and the nose tip rather than a pose estimator,
 * because the tiny landmark model does not provide one and two ratios are
 * enough to separate "looking at the camera" from "looking away".
 */
function facingCamera(detection) {
  const lm = detection.landmarks;
  const left = centre(lm.getLeftEye());
  const right = centre(lm.getRightEye());
  const nose = centre(lm.getNose());
  if (!left || !right || !nose) return true;

  const eyeGap = Math.hypot(right.x - left.x, right.y - left.y);
  if (!eyeGap) return true;

  const midX = (left.x + right.x) / 2;
  const offset = Math.abs(nose.x - midX) / eyeGap;

  const boxWidth = detection.detection?.box?.width ?? 0;
  const spread = boxWidth ? eyeGap / boxWidth : 1;

  return offset <= MAX_NOSE_OFFSET && spread >= MIN_EYE_SPREAD;
}

/** @param {{x: number, y: number}[]} points */
function centre(points) {
  if (!points?.length) return null;
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Human-readable reason, for the form to show. */
export const FACE_MESSAGES = {
  "no-file": "Choose a photo first.",
  "no-face":
    "No face found in that photo. Use a clear, well-lit photo of yourself.",
  "many-faces":
    "That photo has more than one person in it. Use a photo of just you.",
  "too-small":
    "Your face is too small in that photo. Fill the frame with your head and shoulders.",
  "not-facing":
    "Please look straight at the camera. That photo is too side-on to recognise you by.",
  unreadable: "That image could not be read. Try a different file.",
  unavailable: "The face check could not run. Your photo was saved for review.",
};
