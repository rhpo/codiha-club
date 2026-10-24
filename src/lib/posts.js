/**
 * Limits shared by the post form and the server that receives it.
 *
 * They live here rather than in $lib/server/upload.ts because the browser
 * needs them too, and a form that lets somebody pick five images only to be
 * told no afterwards is a worse form.
 */

/** Images per post. Mirrored by a trigger in migration 0012. */
export const POST_IMAGE_LIMIT = 4;

/**
 * Per image, after the browser has downscaled it.
 *
 * The form runs downscaleImage first, which takes a 12 MP phone photo well
 * under this, so hitting the cap means something genuinely large.
 */
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Characters in a post body, matching the check constraint on the column. */
export const POST_BODY_MAX = 4000;

/** Characters in a comment, matching its check constraint. */
export const COMMENT_BODY_MAX = 2000;
