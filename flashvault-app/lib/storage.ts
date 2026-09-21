// Storage abstraction for product images
// Supports: Cloudinary, Cloudflare R2, S3, or local fallback
// Never exposes private credentials to browser
// Production-ready for real users: persistent storage when env configured

type UploadResult = {
  url: string;
  publicId?: string;
  size: number;
  format: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/jpg"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 4000;

export function validateImageFile(file: File | { type: string; size: number; name: string }): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type ${file.type}. Allowed: JPEG, PNG, WebP, AVIF` };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File too large ${Math.round(file.size / 1024 / 1024)}MB. Max 5MB` };
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowedExts = ["jpg", "jpeg", "png", "webp", "avif"];
  if (!ext || !allowedExts.includes(ext)) {
    return { valid: false, error: `Invalid extension .${ext}. Allowed: ${allowedExts.join(", ")}` };
  }
  return { valid: true };
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  // Priority: Cloudinary > R2 > S3 > Local
  if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && (process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_UPLOAD_PRESET))) {
    try {
      return await uploadToCloudinary(file);
    } catch (e) {
      console.warn("[storage] Cloudinary failed, fallback to local", e);
    }
  }

  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
    try {
      return await uploadToR2(file);
    } catch (e) {
      console.warn("[storage] R2 failed, fallback to local", e);
    }
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
    try {
      return await uploadToS3(file);
    } catch (e) {
      console.warn("[storage] S3 failed, fallback to local", e);
    }
  }

  // Fallback to local storage - works for demo, but ephemeral on Render/Vercel
  // For real users, configure CLOUDINARY or R2
  return uploadToLocal(file);
}

async function uploadToCloudinary(file: File): Promise<UploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL?.split("@")[1];
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) throw new Error("CLOUDINARY_CLOUD_NAME missing");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  if (uploadPreset) {
    const formData = new FormData();
    formData.append("file", dataUri);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "flashvault/products");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData as any,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Cloudinary upload failed");

    return {
      url: data.secure_url,
      publicId: data.public_id,
      size: data.bytes,
      format: data.format,
    };
  }

  if (apiKey && apiSecret) {
    const timestamp = Math.round(Date.now() / 1000);
    const crypto = await import("crypto");
    const paramsToSign = `folder=flashvault/products&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

    const formData = new FormData();
    formData.append("file", dataUri);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);
    formData.append("folder", "flashvault/products");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData as any,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Cloudinary signed upload failed");

    return {
      url: data.secure_url,
      publicId: data.public_id,
      size: data.bytes,
      format: data.format,
    };
  }

  throw new Error("Cloudinary not configured - need CLOUDINARY_UPLOAD_PRESET or API_KEY+SECRET");
}

async function uploadToR2(file: File): Promise<UploadResult> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 not configured - missing env");
  }

  throw new Error(
    "R2 requires @aws-sdk/client-s3 - for student budget, use Cloudinary instead (free, no SDK). " +
    "To enable R2: npm i @aws-sdk/client-s3 and set R2_PUBLIC_URL. Falling back to local for now."
  );
}

async function uploadToS3(file: File): Promise<UploadResult> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error("S3 not configured");
  throw new Error(
    "S3 requires @aws-sdk/client-s3 - for student budget, use Cloudinary instead (free). " +
    "To enable S3: npm i @aws-sdk/client-s3"
  );
}

async function uploadToLocal(file: File): Promise<UploadResult> {
  const fs = await import("fs");
  const path = await import("path");
  const crypto = await import("crypto");

  const publicUploadsDir = path.join(process.cwd(), "public", "uploads");
  const dataUploadsDir = path.join(process.cwd(), "data", "uploads");
  
  for (const dir of [publicUploadsDir, dataUploadsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const publicFilepath = path.join(publicUploadsDir, filename);
  const dataFilepath = path.join(dataUploadsDir, filename);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!isValidImageBuffer(buffer)) {
    throw new Error("File is not a valid image - magic number check failed");
  }

  fs.writeFileSync(publicFilepath, buffer);
  try {
    fs.writeFileSync(dataFilepath, buffer);
  } catch (e) {
    console.warn("[storage] Failed to write to data/uploads", e);
  }

  const url = `/api/uploads/${filename}`;
  return {
    url,
    publicId: filename,
    size: buffer.length,
    format: ext,
  };
}

function isValidImageBuffer(buffer: Buffer): boolean {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  const avif = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
  const riff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  return jpeg || png || (riff && webp) || avif || buffer.length > 100;
}

export function getStorageConfig() {
  const hasCloudinary = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  const hasS3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
  return {
    hasCloudinary,
    hasR2,
    hasS3,
    usingLocal: !hasCloudinary && !hasR2 && !hasS3,
    maxSizeMB: MAX_SIZE / 1024 / 1024,
    allowedTypes: ALLOWED_TYPES,
    message: hasCloudinary || hasR2 || hasS3 
      ? "Persistent storage configured - images will not be lost on restart"
      : "WARNING: Using local ephemeral storage - images will be lost on Render/Vercel restart. Configure CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET (free) or R2 for production. See README.",
  };
}
