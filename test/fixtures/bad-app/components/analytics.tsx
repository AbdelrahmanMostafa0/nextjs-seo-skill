import Script from "next/script";

export function Analytics() {
  return (
    <>
      <Script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234" strategy="beforeInteractive" />
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} />
    </>
  );
}
