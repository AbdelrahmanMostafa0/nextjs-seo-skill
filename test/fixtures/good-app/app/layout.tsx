import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  title: { default: "Good App", template: "%s | Good App" },
  description: "A well-wired site.",
  verification: { google: "abc123" },
};

export const viewport: Viewport = { themeColor: "#000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
