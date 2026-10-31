"use client";

import { createContext, Suspense, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { Assistant, type AssistantContext } from "@/components/Assistant";
import { assistantPageForPath } from "@/lib/assistant-pages";

type RepositoryContext = { repoUrl: string; context: AssistantContext; onOpenFile: (path: string) => void };
type Registration = RepositoryContext & { pathname: string };
const RegisterContext = createContext<Dispatch<SetStateAction<Registration | null>> | null>(null);

/** One assistant outside page templates, so its launcher stays available during navigation. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [repository, setRepository] = useState<Registration | null>(null);
  return (
    <RegisterContext.Provider value={setRepository}>
      {children}
      <Suspense fallback={null}><AssistantHost repository={repository} /></Suspense>
    </RegisterContext.Provider>
  );
}

function AssistantHost({ repository }: { repository: Registration | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = repository?.pathname === pathname ? repository : null;
  return (
    <Assistant
      key={`${pathname}:${current?.repoUrl ?? ""}`}
      page={assistantPageForPath(pathname)}
      repoUrl={current?.repoUrl}
      context={current?.context}
      onOpenFile={current?.onOpenFile}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

/** The analysis screen supplies live file context to the shared assistant, without another widget. */
export function RepositoryAssistantContext(props: RepositoryContext) {
  const register = useContext(RegisterContext);
  const pathname = usePathname();
  const { repoUrl, context, onOpenFile } = props;
  useEffect(() => {
    if (!register) return;
    const registration = { pathname, repoUrl, context, onOpenFile };
    register(registration);
    return () => register((current) => current === registration ? null : current);
  }, [register, pathname, repoUrl, context, onOpenFile]);
  return null;
}
