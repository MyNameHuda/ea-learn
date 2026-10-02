/**
 * Cloudinary upload, signed from the server.
 *
 * Why signed rather than an unsigned upload preset: a preset name is public —
 * it ships to the browser with the page — and anyone who opens devtools could
 * post arbitrary files into the account and fill the storage quota. A signed
 * upload keeps the secret on this server, so the only thing that can upload is
 * this route, behind an authenticated session.
 *
 * The SDK is imported lazily inside the function so that a deployment without
 * Cloudinary credentials does not pay for loading it, and so the module never
 * configures the SDK with empty values at import time.
 */
import { v2 as cloudinary } from "cloudinary";

export async function uploadToCloudinary(
  buffer: Buffer,
  opts: { filename: string; contentType: string; folder?: string },
): Promise<string> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  // upload_stream is used rather than upload() because the image is already in
  // memory as a Buffer — sending it through the form-data path would base64 it
  // and inflate the payload for no reason.
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder ?? "ealearn/questions",
        resource_type: "image",
        // The extension is already verified from the magic bytes, so this is
        // a second line of defence rather than the primary check.
        format: opts.filename.split(".").pop(),
        public_id: opts.filename.replace(/\.[^.]+$/, ""),
        overwrite: false,
        // A worksheet image is user content, never executable: keep it out of
        // any inline context the CDN might otherwise guess.
        type: "upload",
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res as { secure_url: string });
      },
    );
    stream.end(buffer);
  });

  return result.secure_url;
}