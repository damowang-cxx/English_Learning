import type { Metadata } from "next";
import "./globals.css";
import ParticleBackground from "@/components/ParticleBackground";
import StarBackground from "@/components/StarBackground";
import CockpitPanel from "@/components/CockpitPanel";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { DictationModeProvider } from "@/contexts/DictationModeContext";
import { FocusModeProvider } from "@/contexts/FocusModeContext";

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
        <TranslationProvider>
          <FocusModeProvider>
            <DictationModeProvider>
              <StarBackground />
              <ParticleBackground />
              <CockpitPanel />
              <div className="scan-line" />
              <div className="relative z-10">
                {children}
              </div>
            </DictationModeProvider>
          </FocusModeProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}
