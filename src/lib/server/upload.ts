import { POST_IMAGE_LIMIT, POST_IMAGE_MAX_BYTES } from "$lib/posts.js";
import { supabaseAdmin } from "./supabaseAdmin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
];
/**
 * Matches MAX_UPLOAD_BYTES in src/lib/image.js. The browser downscales before
 * posting, so what actually arrives here is a few hundred KB; this is the
 * backstop for anything that skips the client path.
 */
const AVATAR_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Upload an event/hackathon cover to the public `covers` bucket.
 * Returns the public URL, or null when no file was supplied.
 * Throws a human-readable Error for the form to surface.
 */
export async function uploadCover(
  file: unknown,
  prefix: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Cover must be a PNG, JPEG, WebP, AVIF or GIF image.");
  }
  if (file.size > MAX_BYTES)
    throw new Error("Cover must be smaller than 5 MB.");

  const ext = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const admin = supabaseAdmin();

  const { error } = await admin.storage
    .from("covers")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Cover upload failed: ${error.message}`);

  return admin.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a member's profile picture to the public `avatars` bucket.
 *
 * The path is keyed by member id and overwritten on each change, so a member
 * leaves one file behind rather than one per upload. The returned URL carries
 * a cache-buster: the path never changes, so without it browsers keep showing
 * the old picture indefinitely.
 */
export async function uploadAvatar(
  file: unknown,
  memberId: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) {
    throw new Error(
      "Your picture must be a PNG, JPEG, WebP, AVIF or GIF image."
    );
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Your picture must be smaller than 20 MB.");
  }

  const ext = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const path = `${memberId}/avatar.${ext}`;
  const admin = supabaseAdmin();

  const { error } = await admin.storage
    .from("avatars")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw new Error(`Picture upload failed: ${error.message}`);

  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  return `${url}?v=${Date.now()}`;
}

// Shared with the browser, which needs the same numbers to build the form.
// Imported as well as re-exported: `export ... from` alone would not bind
// them for the checks below.
export { POST_IMAGE_LIMIT, POST_IMAGE_MAX_BYTES };

/**
 * Uploads the images attached to a post.
 *
 * Unlike an avatar these are additive, so each gets its own name rather than
 * overwriting a fixed path. Anything past the limit is rejected rather than
 * silently dropped: quietly losing somebody's fourth screenshot is worse than
 * telling them.
 */
export async function uploadPostImages(
  files: unknown[],
  postId: string
): Promise<string[]> {
  const images = files.filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (!images.length) return [];

  if (images.length > POST_IMAGE_LIMIT) {
    throw new Error(`A post can have at most ${POST_IMAGE_LIMIT} images.`);
  }

  for (const file of images) {
    if (!ALLOWED.includes(file.type)) {
      throw new Error("Images must be PNG, JPEG, WebP, AVIF or GIF.");
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      throw new Error("Each image must be smaller than 5 MB.");
    }
  }

  const admin = supabaseAdmin();
  const urls: string[] = [];

  for (const [i, file] of images.entries()) {
    const ext = (file.name.split(".").pop() || "png")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const path = `${postId}/${i}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error } = await admin.storage
      .from("post-images")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
    if (error) throw new Error(`Image upload failed: ${error.message}`);

    urls.push(
      admin.storage.from("post-images").getPublicUrl(path).data.publicUrl
    );
  }

  return urls;
}

const GALLERY_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
/** Per file. Videos get more room than photos because they need it. */
const GALLERY_IMAGE_MAX = 10 * 1024 * 1024;
const GALLERY_VIDEO_MAX = 50 * 1024 * 1024;

/**
 * Uploads gallery photos and clips.
 *
 * Returns the kind alongside the URL so the page knows whether to render an
 * <img> or a <video> without having to guess from the extension later.
 */
export async function uploadGalleryFiles(
  files: unknown[]
): Promise<{ url: string; kind: "image" | "video" }[]> {
  const picked = files.filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (!picked.length) return [];

  const admin = supabaseAdmin();
  const out: { url: string; kind: "image" | "video" }[] = [];

  for (const file of picked) {
    const isVideo = GALLERY_VIDEO.includes(file.type);
    if (!isVideo && !ALLOWED.includes(file.type)) {
      throw new Error(`${file.name} is not an image or a video we can show.`);
    }
    const cap = isVideo ? GALLERY_VIDEO_MAX : GALLERY_IMAGE_MAX;
    if (file.size > cap) {
      throw new Error(
        `${file.name} is too large (max ${cap / 1024 / 1024} MB for ${
          isVideo ? "video" : "images"
        }).`
      );
    }

    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    // Date-prefixed so the bucket stays browsable, and random so two
    // uploads of "IMG_1234.jpg" do not collide.
    const path = `${new Date()
      .toISOString()
      .slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

    const { error } = await admin.storage
      .from("gallery")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    out.push({
      url: admin.storage.from("gallery").getPublicUrl(path).data.publicUrl,
      kind: isVideo ? "video" : "image",
    });
  }

  return out;
}

/** base64-encode an admin mail attachment for the Brevo payload. */
export async function fileToAttachment(file: unknown) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(`Attachment "${file.name}" is larger than 8 MB.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return { name: file.name, content: buf.toString("base64"), size: file.size };
}
