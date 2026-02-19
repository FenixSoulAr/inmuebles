import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

/**
 * Returns the authenticated proxy URL for a stored file.
 * Accepts either a raw storage path ("bucket/path/to/file") or a legacy
 * full public URL (https://…/storage/v1/object/public/bucket/path).
 *
 * The serve-file edge function verifies the caller's JWT and checks
 * ownership before returning the file, so buckets can remain private.
 */
export function getFileProxyUrl(
  bucketOrFullUrl: string,
  pathInBucket?: string,
  opts?: { download?: boolean }
): string {
  const base = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/serve-file`;

  // Already a full supabase storage URL?
  if (!pathInBucket && bucketOrFullUrl.includes("/storage/v1/object/")) {
    const params = new URLSearchParams({ url: bucketOrFullUrl });
    if (opts?.download) params.set("download", "1");
    return `${base}?${params}`;
  }

  const bucket = bucketOrFullUrl;
  const path = pathInBucket ?? "";
  const params = new URLSearchParams({ bucket, path });
  if (opts?.download) params.set("download", "1");
  return `${base}?${params}`;
}

/**
 * Opens a file in a new tab via the authenticated proxy.
 * Fetches the file with the user's auth token and creates a blob URL.
 */
export async function openFileViaProxy(
  bucketOrFullUrl: string,
  pathInBucket?: string
): Promise<void> {
  const proxyUrl = getFileProxyUrl(bucketOrFullUrl, pathInBucket);
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    window.open(proxyUrl, "_blank");
    return;
  }
  const resp = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    console.error("File proxy error", resp.status);
    return;
  }
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * Downloads a file via the authenticated proxy.
 */
export async function downloadFileViaProxy(
  bucketOrFullUrl: string,
  pathInBucket?: string,
  filename?: string
): Promise<void> {
  const proxyUrl = getFileProxyUrl(bucketOrFullUrl, pathInBucket, { download: true });
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  const resp = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    console.error("File download proxy error", resp.status);
    return;
  }
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "file";
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
