import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../src/index.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProviderWrapper } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Threat Intel Dashboard",
  description: "Advanced threat intelligence dashboard with interactive radar visualization, real-time monitoring, and actionable security insights for cybersecurity teams.",
  keywords: "threat intelligence, cybersecurity, security dashboard, threat monitoring, vulnerability management, incident response",
  icons: {
    icon: '/placeholder2.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.classList.add(theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <QueryClientProviderWrapper>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </QueryClientProviderWrapper>
      </body>
    </html>
  );
}

