/**
 * File storage helpers using the Manus Forge built-in storage API.
 * No external AWS credentials needed — uses BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY.
 */

function getForgeConfig() {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Manus Forge storage not configured: BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY must be set"
    );
  }
  const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  return { baseUrl, apiKey };
}

/**
 * Upload a file to Manus Forge storage.
 * Returns { key, url } where url is a public CDN URL.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getForgeConfig();
  const key = relKey.replace(/^\/+/, "");

  const buffer =
    typeof data === "string"
      ? Buffer.from(data)
      : data instanceof Buffer
      ? data
      : Buffer.from(data);

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: contentType }),
    key.split("/").pop() || "file"
  );
  form.append("path", key);

  const response = await fetch(`${baseUrl}/v1/storage/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  const result = (await response.json()) as { url: string };
  return { key, url: result.url };
}

/**
 * Get the public URL for a stored file.
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getForgeConfig();
  const key = relKey.replace(/^\/+/, "");

  // Try presign/get endpoint first
  try {
    const presignUrl = new URL(`${baseUrl}/v1/storage/presign/get`);
    presignUrl.searchParams.set("path", key);
    const response = await fetch(presignUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      const result = (await response.json()) as { url: string };
      return { key, url: result.url };
    }
  } catch {
    // fall through
  }

  // Fallback: reconstruct CDN URL pattern
  const uploadUrl = await storagePut(key, Buffer.alloc(0), "application/octet-stream").catch(() => null);
  if (uploadUrl) return { key, url: uploadUrl.url };

  throw new Error(`Could not retrieve URL for storage key: ${key}`);
}
