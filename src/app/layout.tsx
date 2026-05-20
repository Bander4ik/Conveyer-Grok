import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "./_sidebar";

export const metadata = {
  title: "Conveyer Grok",
  description: "Local pipeline platform for faceless AI YouTube videos — Grok video + HeyGen voice.",
};

// Applied before first paint so the chosen theme doesn't flash (anti-FOUC).
const themeScript = `try{if(localStorage.getItem('theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 1080, padding: "32px 36px 80px" }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
