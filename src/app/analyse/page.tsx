import { Suspense } from "react";
import { AnalysisApp } from "@/components/AnalysisApp";
import { getUser } from "@/lib/session";

async function AnalysePageBody() {
  const user = await getUser();
  return <AnalysisApp user={user} />;
}

export default function AnalysePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AnalysePageBody  />
    </Suspense>
  );
}
