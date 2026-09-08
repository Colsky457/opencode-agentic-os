"use client";

import { ThemeProvider } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // first-run gate: no os.config.json → send to the setup wizard
  useEffect(() => {
    if (!mounted || pathname === "/setup") return;
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.needsSetup) router.replace("/setup");
      })
      .catch(() => {});
  }, [mounted, pathname, router]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
    </ThemeProvider>
  );
}
