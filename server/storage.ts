/**
 * S3-compatible file storage helpers.
 * Uses AWS S3 (or any S3-compatible service like Cloudflare R2) directly.
 * Required env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION          (e.g. us-east-1)
 *   AWS_S3_BUCKET       (bucket name)
 *   AWS_S3_ENDPOINT     (optional — for R2 or custom endpoints)
 */

function getS3Config() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION ?? "us-east-1";
  const bucket = process.env.AWS_S3_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT; // optional (R2, MinIO, etc.)

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "S3 credentials missing: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET"
    );
  }
  return { accessKeyId, secretAccessKey, region, bucket, endpoint };
}

/**
 * Sign a request using AWS Signature Version 4 (pure fetch, no SDK dependency).
 */
async function signedFetch(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body?: Buffer | Uint8Array | string
): Promise<Response> {
  const { accessKeyId, secretAccessKey, region } = getS3Config();
  const service = "s3";
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

  const host = url.host;
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-date";

  const bodyBytes: ArrayBuffer = body
    ? typeof body === "string"
      ? new TextEncoder().encode(body).buffer as ArrayBuffer
      : (body instanceof Buffer ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : (body as Uint8Array).buffer) as ArrayBuffer
    : new ArrayBuffer(0);
  const payloadHashBuffer = await crypto.subtle.digest("SHA-256", bodyBytes);
  const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalRequest)
      )
    )
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)) as Promise<ArrayBuffer>;
  }

  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signatureBuffer = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url.toString(), {
    method,
    headers: {
      ...headers,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: body ? (body as BodyInit) : undefined,
  });
}

function buildS3Url(key: string): URL {
  const { region, bucket, endpoint } = getS3Config();
  if (endpoint) {
    const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
    return new URL(`${base}${bucket}/${key}`);
  }
  return new URL(`https://${bucket}.s3.${region}.amazonaws.com/${key}`);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const url = buildS3Url(key);

  const response = await signedFetch(
    "PUT",
    url,
    {
      "Content-Type": contentType,
      "x-amz-acl": "public-read",
    },
    typeof data === "string" ? Buffer.from(data) : data
  );

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `S3 upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  return { key, url: url.toString() };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const url = buildS3Url(key);
  return { key, url: url.toString() };
}
