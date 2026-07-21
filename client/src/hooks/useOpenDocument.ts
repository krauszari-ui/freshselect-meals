/**
 * useOpenDocument — opens a stored document by fetching a fresh pre-signed URL
 * before navigating, so expired R2 presigned URLs never cause an "ExpiredRequest" error.
 *
 * Usage:
 *   const openDocument = useOpenDocument();
 *   <button onClick={() => openDocument(doc.fileKey, doc.submissionId)}>Open</button>
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useOpenDocument() {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState<string | null>(null); // fileKey currently loading

  const openDocument = useCallback(
    async (fileKey: string | null | undefined, submissionId?: number | null) => {
      if (!fileKey) {
        toast.error("Document key is missing — cannot open file.");
        return;
      }
      setLoading(fileKey);
      try {
        const { url } = await utils.admin.documents.getFreshUrl.fetch({
          fileKey,
          submissionId: submissionId ?? null,
        });
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("[openDocument] failed to get fresh URL:", err);
        toast.error("Could not open document. Please try again.");
      } finally {
        setLoading(null);
      }
    },
    [utils]
  );

  return { openDocument, loading };
}
