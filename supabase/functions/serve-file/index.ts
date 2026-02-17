import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Proxy endpoint to serve storage files from the app's own domain,
 * avoiding direct supabase.co URLs that get blocked by browser extensions (adblock, etc).
 *
 * Query params:
 *   bucket: storage bucket name (e.g. "proof-files", "documents")
 *   path: file path within the bucket
 *   download: if "1", forces Content-Disposition: attachment
 *
 * Or:
 *   url: full supabase storage public URL — the function extracts bucket/path automatically
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let bucket = url.searchParams.get("bucket");
    let path = url.searchParams.get("path");
    const download = url.searchParams.get("download") === "1";
    const rawUrl = url.searchParams.get("url");

    // If a full URL was provided, extract bucket and path
    if (rawUrl && (!bucket || !path)) {
      const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Download file from storage
    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error || !data) {
      console.error("Storage download error:", error);
      return new Response(
        JSON.stringify({ error: "file_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine content type from extension
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

    // Build filename for download
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
