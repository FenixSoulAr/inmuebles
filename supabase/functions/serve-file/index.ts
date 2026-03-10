import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Authenticated file proxy — serves storage files through the app domain.
 * Avoids direct supabase.co URLs that get blocked by browser extensions.
 *
 * Security: requires a valid JWT. Verifies the user owns the resource before
 * serving any file. Returns 401/403 on authentication or authorization failure.
 *
 * Query params:
 *   bucket: storage bucket name (e.g. "proof-files", "documents")
 *   path:   file path within the bucket
 *   download: if "1", forces Content-Disposition: attachment
 *
 * Or:
 *   url: full supabase storage URL — bucket/path extracted automatically
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use anon client with the caller's JWT so RLS is enforced
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub;

    // Service-role client for actual file download (only used after ownership check)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 2. Parse request params ────────────────────────────────────────────
    const url = new URL(req.url);
    let bucket = url.searchParams.get("bucket");
    let path = url.searchParams.get("path");
    const download = url.searchParams.get("download") === "1";
    const rawUrl = url.searchParams.get("url");

    if (rawUrl && (!bucket || !path)) {
      const match = rawUrl.match(
        /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/
      );
      if (match) {
        bucket = match[1];
        path = decodeURIComponent(match[2]);
      }
    }

    if (!bucket || !path) {
      return new Response(
        JSON.stringify({ error: "missing_params", detail: "bucket and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2b. Bucket whitelist ───────────────────────────────────────────────
    const ALLOWED_BUCKETS = ["documents", "proof-files", "contract-documents"];
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return new Response(
        JSON.stringify({ error: "invalid_bucket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2c. Path traversal sanitization ────────────────────────────────────
    path = path.replace(/\.\.\//g, "").replace(/\.\.\\/g, "").replace(/\0/g, "").replace(/^\/+/, "");
    if (path.includes("..") || path.startsWith("/") || !path) {
      return new Response(
        JSON.stringify({ error: "invalid_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Ownership authorization ─────────────────────────────────────────
    const allowed = await isAuthorized(anonClient, userId, bucket, path);
    if (!allowed) {
      console.warn("serve-file: access denied", { userId, bucket, path });
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Serve the file ──────────────────────────────────────────────────
    const { data, error: dlError } = await adminClient.storage.from(bucket).download(path);
    if (dlError || !data) {
      console.error("Storage download error:", dlError);
      return new Response(
        JSON.stringify({ error: "file_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";
    const filename = path.split("/").pop() || "file";
    const disposition = download
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("serve-file error:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Checks whether `userId` is allowed to access `path` in `bucket`.
 * Uses path-based heuristics: the first path segment is typically the
 * owner-id (documents bucket) or the contract-id (proof-files / contract-documents).
 */
async function isAuthorized(
  client: ReturnType<typeof createClient>,
  userId: string,
  bucket: string,
  path: string
): Promise<boolean> {
  // Segment[0] is the first path component
  const segments = path.split("/");
  const firstSegment = segments[0];

  if (bucket === "documents") {
    // Files are stored as  <owner_user_id>/<filename>
    // OR as <property_id>/<filename> (older pattern, verified via property ownership)
    if (firstSegment === userId) return true;

    // Fallback: check if firstSegment is a property owned by the user
    const { data } = await client
      .from("properties")
      .select("id")
      .eq("id", firstSegment)
      .eq("owner_user_id", userId)
      .maybeSingle();
    return !!data;
  }

  if (bucket === "proof-files" || bucket === "contract-documents") {
    // Files stored as  <contract_id>/<filename>
    const contractId = firstSegment;
    const { data } = await client
      .from("contracts")
      .select("id, properties!inner(owner_user_id)")
      .eq("id", contractId)
      .eq("properties.owner_user_id", userId)
      .maybeSingle();
    return !!data;
  }

  // Unknown bucket — deny by default
  return false;
}
