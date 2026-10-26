import { Suspense } from "react";
import { AppShell } from "@/shared/presentation/app-shell";
import { AppNavigation, AppNavigationSkeleton, AppUserMenu } from "./app-navigation";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      navigation={
        <Suspense fallback={<AppNavigationSkeleton />}>
          <AppNavigation />
        </Suspense>
      }
      userMenu={
        <Suspense>
          <AppUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
