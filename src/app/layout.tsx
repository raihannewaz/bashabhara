import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = { title: "BashaBhara" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <ThemeToggle />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
