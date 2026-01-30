import type { Metadata } from "next";
import "./globals.css";
import ParticleBackground from "@/components/ParticleBackground";
import StarBackground from "@/components/StarBackground";
import CockpitOverlay from "@/components/CockpitOverlay";

export const metadata: Metadata = {
  title: "英语学习训练",
  description: "英语学习训练网站 - 通过音频和句子分段学习英语",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased relative">
        <StarBackground />
        <ParticleBackground />
        <CockpitOverlay />
        <div className="scan-line" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
