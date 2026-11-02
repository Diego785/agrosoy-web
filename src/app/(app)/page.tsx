import { Suspense } from "react";
import { HomeDashboard } from "./home-dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl bg-muted" />}>
      <HomeDashboard />
    </Suspense>
  );
}
