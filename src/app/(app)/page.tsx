import { Suspense } from "react";
import { HomeDashboard, HomeDashboardSkeleton } from "./home-dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeDashboardSkeleton />}>
      <HomeDashboard />
    </Suspense>
  );
}
