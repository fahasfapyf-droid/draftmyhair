import { issueSignedToken, presignUrl } from "@vercel/blob";
import type { IssuedSignedToken } from "@vercel/blob";

const GALLERY_PREFIX = "content/gallery/";
const GALLERY_MEDIA_ROUTE = "/api/gallery/media";

function extractGalleryPath(value: string) {
  if (value.startsWith(`${GALLERY_MEDIA_ROUTE}?pathname=`)) {
    const pathname = new URL(value, "https://draftmyhair.local").searchParams.get("pathname");
    return pathname?.startsWith(GALLERY_PREFIX) ? pathname : null;
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    return pathname.startsWith(GALLERY_PREFIX) ? pathname : null;
  } catch {
    return null;
  }
}

export async function toGalleryMediaUrl(
  value: string,
  delegationToken?: IssuedSignedToken,
) {
  const pathname = extractGalleryPath(value);
  if (!pathname) return value;

  const token = delegationToken ?? (
    await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil: Date.now() + 60 * 60 * 1000,
    })
  );

  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil: Date.now() + 10 * 60 * 1000,
  });

  return presignedUrl;
}
