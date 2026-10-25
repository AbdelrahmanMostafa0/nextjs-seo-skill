import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bad App",
  themeColor: "#000",
  alternates: { canonical: "/" },
  openGraph: { url: "/", siteName: "Bad App" },
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
