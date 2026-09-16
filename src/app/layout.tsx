import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Blueprint Recruiting", template: "%s · Blueprint Recruiting" },
  description: "The private recruiting workspace for NYC Blueprint leadership.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
