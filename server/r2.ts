/**
 * Cloudflare R2 storage adapter.
 *
 * R2 is S3-API-compatible, so we use the standard @aws-sdk/client-s3 with R2's
 * endpoint and credentials. Files persist beyond container restarts (unlike
 * Replit's local disk) and egress is free, which matters for delivering MP4s
 * to social platforms.
 *
 * Configuration via env vars (set on the Cloudflare Container in PR 1.7,
 * or locally via .env / Replit Secrets):
 *   R2_ACCOUNT_ID         — your Cloudflare account ID (32-char hex)
 *   R2_BUCKET             — bucket name (e.g. "emerge-control-tower-assets")
 *   R2_ACCESS_KEY_ID      — generated via Cloudflare dashboard > R2 > API tokens
 *   R2_SECRET_ACCESS_KEY  — same source as above
 *   R2_PUBLIC_BASE_URL    — optional. If set, public URLs use this domain
 *                           (e.g. https://assets.emerge.digital) instead of
 *                           signed URLs. Useful if the bucket is fronted by
 *                           a Cloudflare custom domain.
 *
 * File-path convention: DB rows store the R2 key prefixed with "r2://" so we
 * can distinguish R2-backed files from legacy local-disk paths during the
 * transition period. Use isR2Key() to dispatch.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

const R2_KEY_PREFIX = 'r2://';

function envR2(): {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
} | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return {
    accountId,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  };
}

export function isR2Configured(): boolean {
  return envR2() !== null;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const cfg = envR2();
  if (!cfg) {
    throw new Error(
      'R2 not configured. Set R2_ACCOUNT_ID, R2_BUCKET, ' +
      'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
    );
  }
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

function getBucket(): string {
  const cfg = envR2();
  if (!cfg) throw new Error('R2 not configured');
  return cfg.bucket;
}

/** Upload a Buffer to R2 at the given key. */
export async function r2Put(
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch an R2 object as a Buffer. */
export async function r2Get(key: string): Promise<Buffer> {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
  if (!result.Body) {
    throw new Error(`R2 object ${key} has no body`);
  }
  const stream = result.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/** Delete an R2 object. Safe to call on a missing key (logs + swallows). */
export async function r2Delete(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  } catch (err: any) {
    // R2 returns 204 for both existing-deleted and missing keys, but the SDK
    // can throw on access issues — log and continue rather than block delete-row.
    console.warn(`[R2] delete failed for key ${key}: ${err?.message ?? err}`);
  }
}

/**
 * Generate a time-limited URL for downloading an R2 object. If
 * R2_PUBLIC_BASE_URL is set (bucket fronted by a Cloudflare custom domain),
 * returns the unsigned public URL instead — much cheaper and CDN-cacheable.
 */
export async function r2GetUrl(
  key: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const cfg = envR2();
  if (!cfg) throw new Error('R2 not configured');
  if (cfg.publicBaseUrl) {
    const base = cfg.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Path conventions — distinguish R2-backed rows from legacy local paths.  */
/* ──────────────────────────────────────────────────────────────────────── */

/** True if a stored filePath represents an R2 object (not a local disk path). */
export function isR2Key(filePath: string): boolean {
  return filePath.startsWith(R2_KEY_PREFIX);
}

/** Strip the r2:// prefix to get the bare R2 key. */
export function r2KeyOf(filePath: string): string {
  return filePath.startsWith(R2_KEY_PREFIX)
    ? filePath.slice(R2_KEY_PREFIX.length)
    : filePath;
}

/** Wrap a bare R2 key with the r2:// prefix for DB storage. */
export function r2FilePath(key: string): string {
  return `${R2_KEY_PREFIX}${key}`;
}

/**
 * Build a deterministic R2 key for a brand asset upload. Mirrors the previous
 * disk-storage layout (brand-assets/{clientId}/{category}/{subcategory}/...)
 * so historical paths remain readable side-by-side with new R2 keys.
 */
export function makeBrandAssetKey(opts: {
  clientId: string | number;
  category: string;
  subcategory?: string | null;
  originalName: string;
}): { key: string; fileName: string } {
  const uniqueSuffix = `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 11)}`;
  const ext = opts.originalName.includes('.')
    ? opts.originalName.slice(opts.originalName.lastIndexOf('.'))
    : '';
  const baseName = opts.originalName
    .slice(0, opts.originalName.length - ext.length)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${baseName}_${uniqueSuffix}${ext}`;
  const parts = [
    'brand-assets',
    String(opts.clientId),
    opts.category,
    ...(opts.subcategory ? [opts.subcategory] : []),
    fileName,
  ];
  return { key: parts.join('/'), fileName };
}
