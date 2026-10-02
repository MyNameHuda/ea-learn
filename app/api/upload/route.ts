// POST /api/upload — store an image for a question.
//
// Images are the first thing this app accepts from users, so the file handling
// is written as if it were hostile input, because one day it will be:
//
//   - The type is decided by reading the file's magic bytes, never by the
//     browser-supplied `Content-Type` or the filename. Both are attacker
//     controlled; a .php or .html upload renamed to .png would sail through
//     either check.
//   - The stored name is generated, not derived. Using the uploaded filename
//     would let "../../etc/passwd" and "a<script>.png" through.
//   - SVG is rejected outright. It is an XML document that can carry <script>,
//     and the file would be served from the same origin as the app, so an
//     uploaded SVG is stored XSS. Refusing it is cheaper than sanitising it.
//   - Size is checked before the body is read into memory, then checked again
//     on the buffer, because Content-Length is a claim rather than a fact.
//
// Question images go to Cloudinary.
//
// The serverless filesystem is read-only and discarded between invocations, so
// writing to public/uploads/questions/ works in `npm run dev` and silently
// loses every file in production. Cloudinary is the store; the local disk stays
// only as a development convenience, and production refuses to use it.
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { hit, KEYS, LIMITS } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "questions");
const FOLDER = "ealearn/questions";

/**
 * Cloudinary is used when all three credentials are present, which is what
 * happens in production. Without them — local development — the route falls
 * back to the filesystem.
 */
function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/** Extensions we are willing to emit, keyed by the signature we detected. */
const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", mime: "image/gif", test: (b) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

function detectImage(buf: Buffer) {
  return SIGNATURES.find((s) => {
    try {
      return s.test(buf);
    } catch {
      return false;
    }
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  // Each accepted upload costs money and permanent storage at Cloudinary, so an
  // open endpoint is a billing attack. Thirty an hour is more than a parent
  // making question sheets will use and far less than a loop.
  const budget = await hit(
    KEYS.uploadUser(session.user.id),
    LIMITS.upload.perUser,
    LIMITS.upload.windowMs,
  );
  if (!budget.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak upload. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } },
    );
  }

  // Reject on the claim before reading anything.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return NextResponse.json(
      { error: `Gambar maksimal ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Gunakan multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Field 'file' wajib diisi." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File kosong." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Gambar maksimal ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Gambar maksimal ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const kind = detectImage(buf);
  if (!kind) {
    return NextResponse.json(
      { error: "Format harus PNG, JPG, GIF, atau WebP. SVG tidak diterima." },
      { status: 415 },
    );
  }

  // Random name, correct extension. The original filename is discarded
  // entirely — it is the one piece of this input with no safe interpretation.
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${kind.ext}`;

  if (cloudinaryConfigured()) {
    const { uploadToCloudinary } = await import("@/lib/cloudinary");
    const url = await uploadToCloudinary(buf, {
      filename: name,
      contentType: kind.mime,
    });
    return NextResponse.json(
      { url, mime: kind.mime, bytes: buf.byteLength, storage: "cloudinary" },
      { status: 201 },
    );
  }

  // In production this is not a fallback, it is a data-loss bug: the Vercel
  // function filesystem is discarded when the invocation ends, so the file
  // would 404 on the next request. Failing loudly beats accepting an upload
  // that is guaranteed to disappear.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Penyimpanan gambar belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY dan CLOUDINARY_API_SECRET.",
      },
      { status: 503 },
    );
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);

  return NextResponse.json(
    {
      url: `/uploads/questions/${name}`,
      mime: kind.mime,
      bytes: buf.byteLength,
      storage: "disk",
    },
    { status: 201 },
  );
}
