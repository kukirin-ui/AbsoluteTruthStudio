import { uid } from "./utils";

export type UserFile = {
  id: string;
  name: string;
  mime: string;
  kind: "image" | "video" | "text" | "archive" | "other";
  dataUrl?: string;
  text?: string;
  size: number;
};

export const MAX_USER_FILES = 6;
const MAX_TEXT_CHARS = 40_000;
const MAX_TEXT_BYTES = 120_000;
/** Reject before decode — avoids OOM/freeze on huge PNGs (e.g. 20MB). */
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100MB for ZIP files
const IMAGE_MAX_EDGE = 1280;

export function imageRefs(files: UserFile[]) {
  return files.filter((f) => f.dataUrl && (f.kind === "image" || f.kind === "video")).map((f) => f.dataUrl!);
}

export function textRefs(files: UserFile[]) {
  return files.filter((f) => f.kind === "text" && f.text?.trim());
}

export function filesBrief(files: UserFile[]) {
  if (!files.length) return "";
  const images = files.filter((f) => f.kind === "image" || f.kind === "video");
  const texts = textRefs(files);
  const lines: string[] = [];
  if (images.length) {
    lines.push(
      `USER ATTACHED ${images.length} reference ${images.length === 1 ? "frame" : "frames"} of the exact product. Visual MUST match those frames — same make, model, color, geometry. Do not substitute a similar brand.`,
    );
  }
  for (const t of texts) {
    lines.push(`ATTACHED FILE ${t.name}:\n${t.text!.slice(0, 8000)}`);
  }
  return lines.join("\n\n");
}

/**
Read/validate user attachments. Never throws — failures become `errors` with fix hints.
*/
export async function readUserFiles(
  list: FileList | File[] | null | undefined,
  opts?: { remainingSlots?: number },
): Promise<{ files: UserFile[]; errors: string[] }> {
  try {
    const raw = list == null ? [] : [...list];
    if (!raw.length) return { files: [], errors: [] };
    const slots =
      typeof opts?.remainingSlots === "number"
        ? Math.max(0, Math.min(MAX_USER_FILES, opts.remainingSlots))
        : MAX_USER_FILES;
    if (slots <= 0) {
      return {
        files: [],
        errors: [`Already at ${MAX_USER_FILES} files. Remove one before attaching more.`],
      };
    }
    const incoming = raw.slice(0, slots);
    const skippedForCap = raw.length - incoming.length;
    const files: UserFile[] = [];
    const errors: string[] = [];
    if (skippedForCap > 0) {
      errors.push(
        `Only ${slots} more file${slots === 1 ? "" : "s"} allowed (max ${MAX_USER_FILES}). ${skippedForCap} skipped.`,
      );
    }
    for (const file of incoming) {
      try {
        const item = await readOne(file);
        files.push(item);
      } catch (err) {
        const why = err instanceof Error && err.message ? err.message : "Could not read that file.";
        errors.push(`${file?.name || "file"}: ${why}`);
      }
    }
    return { files, errors };
  } catch (err) {
    const why = err instanceof Error && err.message ? err.message : "Attach failed unexpectedly.";
    return { files: [], errors: [why] };
  }
}

async function readOne(file: File): Promise<UserFile> {
  if (!file || typeof file !== "object") {
    throw new Error("Invalid file. Try again from +.");
  }
  const name = (file.name || "file").trim() || "file";
  if (file.size === 0) {
    throw new Error("Empty file — nothing to attach.");
  }
  if (isHeic(file)) {
    throw new Error("HEIC/HEIF is not supported. Export as JPG or PNG in Photos, then attach.");
  }
  if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image is too large (${fmtMb(file.size)}). Compress or export JPG/PNG under ${fmtMb(MAX_IMAGE_BYTES)}.`,
      );
    }
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file);
    } catch (err) {
      const why = err instanceof Error && err.message ? err.message : "Could not decode image.";
      throw new Error(`${why} Try JPG or PNG.`);
    }
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      throw new Error("Image decode failed. Try JPG or PNG.");
    }
    return {
      id: uid("file"),
      name,
      mime: "image/jpeg",
      kind: "image",
      dataUrl,
      size: dataUrl.length,
    };
  }
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error(
        `Video is too large (${fmtMb(file.size)}). Use a short clip under ${fmtMb(MAX_VIDEO_BYTES)}, or attach a JPG/PNG frame.`,
      );
    }
    try {
      const dataUrl = await videoPoster(file);
      return {
        id: uid("file"),
        name,
        mime: file.type || "video/mp4",
        kind: "video",
        dataUrl,
        size: file.size,
      };
    } catch {
      throw new Error("Could not grab a video frame. Use a JPG or PNG of the product instead.");
    }
  }
  if (isTextLike(file)) {
    if (file.size > MAX_TEXT_BYTES) {
      throw new Error(
        `Text file is too large (${fmtKb(file.size)}). Max ~${fmtKb(MAX_TEXT_BYTES)} — trim or split the file.`,
      );
    }
    let text: string;
    try {
      text = (await file.text()).slice(0, MAX_TEXT_CHARS);
    } catch {
      throw new Error("Could not read that text/code file. Save as UTF-8 and retry.");
    }
    return {
      id: uid("file"),
      name,
      mime: file.type || "text/plain",
      kind: "text",
      text,
      size: file.size,
    };
  }
  // Handle ZIP archives
  if (isZipFile(file)) {
    if (file.size > MAX_ARCHIVE_BYTES) {
      throw new Error(
        `ZIP file is too large (${fmtMb(file.size)}). Max ${fmtMb(MAX_ARCHIVE_BYTES)} — compress or split the archive.`,
      );
    }
    return {
      id: uid("file"),
      name,
      mime: file.type || "application/zip",
      kind: "archive",
      size: file.size,
    };
  }
  throw new Error("Unsupported type. Use JPG, PNG, WebP, GIF, MP4, ZIP, or a text/code file.");
}

function fmtMb(n: number) {
  return `${Math.round((n / (1024 * 1024)) * 10) / 10}MB`;
}

function fmtKb(n: number) {
  return `${Math.round(n / 1024)}KB`;
}

function ext(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function isHeic(file: File) {
  if (/heic|heif/i.test(file.type || "")) return true;
  return /^(heic|heif)$/i.test(ext(file.name || ""));
}

function isImageFile(file: File) {
  if (/heic|heif/i.test(file.type || "")) return false;
  if (/^image\//i.test(file.type || "")) return true;
  return /^(jpe?g|png|gif|webp|bmp|avif)$/i.test(ext(file.name || ""));
}

function isVideoFile(file: File) {
  if (/^video\//i.test(file.type || "")) return true;
  return /^(mp4|mov|webm|m4v|3gp)$/i.test(ext(file.name || ""));
}

function isTextLike(file: File) {
  if (/^text/|^application/(json|javascript|xml|typescript)/i.test(file.type || "")) return true;
  return /^(tsx?|jsx?|mjs|cjs|css|html?|md|json|txt|svg|csv|yml|yaml|toml|py|rs|go|java|kt)$/i.test(
    ext(file.name || ""),
  );
}

function isZipFile(file: File) {
  if (/zip/i.test(file.type || "")) return true;
  return /^(zip)$/i.test(ext(file.name || ""));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onabort = () => reject(new Error("Read was cancelled"));
    try {
      reader.readAsDataURL(file);
    } catch {
      reject(new Error("Could not read that file"));
    }
  });
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number): string {
  const max = IMAGE_MAX_EDGE;
  const scale = Math.min(1, max / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function compressImage(file: File): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      let bmp: ImageBitmap;
      try {
        bmp = await createImageBitmap(file, {
          resizeWidth: IMAGE_MAX_EDGE,
          resizeQuality: "high",
        });
      } catch {
        bmp = await createImageBitmap(file);
      }
      try {
        return drawToJpeg(bmp, bmp.width, bmp.height);
      } finally {
        bmp.close();
      }
    } catch {
      /* fall through */
    }
  }
  try {
    return await compressViaImageElement(file);
  } catch {
    const raw = await fileToDataUrl(file);
    if (raw.startsWith("data:image/") && raw.length < 6_000_000) return raw;
    throw new Error("That image format isn't readable");
  }
}

function compressViaImageElement(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      done();
      reject(new Error(msg));
    };
    const timer = window.setTimeout(() => fail("Image took too long to decode"), 10_000);
    img.onload = () => {
      if (settled) return;
      try {
        const jpeg = drawToJpeg(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
        settled = true;
        window.clearTimeout(timer);
        done();
        resolve(jpeg);
      } catch (err) {
        window.clearTimeout(timer);
        fail(err instanceof Error ? err.message : "Could not decode image");
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      fail("Could not decode image");
    };
    img.src = url;
  });
}

function videoPoster(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };
    const fail = (msg = "Could not read video") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      reject(new Error(msg));
    };
    const timer = window.setTimeout(() => fail("Video took too long — try a JPG/PNG instead"), 6000);
    const grab = () => {
      if (settled) return;
      try {
        if (!video.videoWidth) {
          fail("Could not grab a video frame");
          return;
        }
        const jpeg = drawToJpeg(video, video.videoWidth, video.videoHeight);
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        resolve(jpeg);
      } catch {
        fail("Could not grab a video frame");
      }
    };
    video.addEventListener("seeked", grab, { once: true });
    video.onloadeddata = () => {
      try {
        const t = Number.isFinite(video.duration) ? Math.min(0.25, video.duration * 0.05) : 0.1;
        video.currentTime = t;
      } catch {
        grab();
      }
    };
    video.onerror = () => fail("Could not read video");
    try {
      video.src = url;
      void video.load();
    } catch {
      fail("Could not read video");
    }
  });
}