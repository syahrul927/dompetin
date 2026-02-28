"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";

interface WorkspaceContextType {
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("dompetin_workspace_id");
    if (stored) {
      setWorkspaceIdState(stored);
    }
  }, []);

  const setWorkspaceId = (id: string) => {
    setWorkspaceIdState(id);
    localStorage.setItem("dompetin_workspace_id", id);
  };

  const { data: session } = authClient.useSession();
  const isAuthenticated = !!session?.user;

  // Auto-select: fetch workspaces when no workspace is stored
  const { data: workspaces } = api.workspace.getWorkspaces.useQuery(
    {},
    {
      enabled: isMounted && !workspaceId && isAuthenticated,
      retry: false, // don't retry on auth errors (login/register pages)
    },
  );

  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceId(workspaces[0]!.id);
    }
  }, [workspaceId, workspaces]);

  if (!isMounted) {
    return (
      <WorkspaceContext.Provider value={{ workspaceId: "", setWorkspaceId }}>
        {children}
      </WorkspaceContext.Provider>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ workspaceId, setWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useActiveWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error(
      "useActiveWorkspace must be used within a WorkspaceProvider"
    );
  }
  return context;
}
