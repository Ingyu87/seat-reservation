function normalizeSiteUrl(value?: string) {
  const url = value?.trim();
  return url ? url.replace(/\/$/, "") : "";
}

export function getAdminSiteUrl() {
  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_ADMIN_SITE_URL);
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") return "http://localhost:3001";
  return "";
}

export function getBookingSiteUrl() {
  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_BOOKING_SITE_URL);
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "";
}
