const GALLERY_PREFIX = "content/gallery/";
const GALLERY_MEDIA_ROUTE = "/api/gallery/media";

export function toGalleryMediaUrl(value: string) {
  if (value.startsWith(`${GALLERY_MEDIA_ROUTE}?pathname=`)) return value;

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    if (pathname.startsWith(GALLERY_PREFIX)) {
      return `${GALLERY_MEDIA_ROUTE}?pathname=${encodeURIComponent(pathname)}`;
    }
  } catch {
    // Keep non-URL values unchanged. Local paths and existing internal URLs
    // are already suitable for the application.
  }

  return value;
}
