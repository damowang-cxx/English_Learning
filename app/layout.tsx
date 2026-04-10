import type { Metadata } from "next";
import "./globals.css";
import ParticleBackground from "@/components/ParticleBackground";
import StarBackground from "@/components/StarBackground";
import CockpitPanel from "@/components/CockpitPanel";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { DictationModeProvider } from "@/contexts/DictationModeContext";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { CockpitUiProvider } from "@/contexts/CockpitUiContext";

const BASE_PATH = "/listen";

export const metadata: Metadata = {
  title: "英语学习训练",
  description: "英语学习训练网站 - 通过音频和句子分段学习英语",
  icons: {
    icon: [
      { url: `${BASE_PATH}/Learnico16x16.ico`, sizes: "16x16", type: "image/x-icon" },
      { url: `${BASE_PATH}/Learnico32x32.ico`, sizes: "32x32", type: "image/x-icon" },
      { url: `${BASE_PATH}/Learnico48x48.ico`, sizes: "48x48", type: "image/x-icon" },
      { url: `${BASE_PATH}/Learnico.png`, type: "image/png" },
    ],
    shortcut: `${BASE_PATH}/Learnico32x32.ico`,
    apple: `${BASE_PATH}/Learnico.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased relative">
        <AuthSessionProvider>
          <TranslationProvider>
            <FocusModeProvider>
              <DictationModeProvider>
                <CockpitUiProvider>
                  <StarBackground />
                  <ParticleBackground />
                  <CockpitPanel />
                  <div className="scan-line" />
                  <div className="relative z-10">{children}</div>
                </CockpitUiProvider>
              </DictationModeProvider>
            </FocusModeProvider>
          </TranslationProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
