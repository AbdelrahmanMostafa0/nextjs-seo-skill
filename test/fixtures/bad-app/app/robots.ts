export default function robots() {
  return { rules: { userAgent: "*", disallow: ["/secret-admin/", "/_next/"] } };
}
