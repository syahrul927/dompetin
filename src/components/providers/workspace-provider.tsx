"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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

  // Prevent hydration mismatch by not rendering anything that depends on workspaceId
  // until we've mounted on the client and read from localStorage.
  // Actually, for a provider, it's safe to render children, just the initial state is empty.
  if (!isMounted) {
    // Return early or render children with empty state.
    // Rendering children is usually fine as long as components relying on workspaceId
    // handle the empty string gracefully during initial mount.
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
