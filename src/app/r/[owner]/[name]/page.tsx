import { MascotLoader } from "@/components/MascotLoader";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalysisApp } from "@/components/AnalysisApp";
import { getUser } from "@/lib/session";

type Params = Promise<{ owner: string; name: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, name } = await params;
  return { title: `${owner}/${name} · Ghost-Architect` };
}

async function RepoPageBody({ params }: { params: Params }) {
  const { owner, name } = await params;
  const user = await getUser();
  return <AnalysisApp initialRepo={`https://github.com/${owner}/${name}`} autoRun user={user} />;
}

export default function RepoPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<MascotLoader />}>
      <RepoPageBody params={params} />
    </Suspense>
  );
}
