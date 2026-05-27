import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phỏng vấn ảo",
  description: "Buổi phỏng vấn trực tuyến tự động bằng giọng nói",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
