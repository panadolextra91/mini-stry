import React, { createContext, useContext, useState, ReactNode } from "react";

interface DemoContextType {
  tenantId: string | null;
  actorId: string | null;
  setTenantId: (id: string | null) => void;
  setActorId: (id: string | null) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);

  return (
    <DemoContext.Provider value={{ tenantId, actorId, setTenantId, setActorId }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemoContext must be used within a DemoProvider");
  }
  return context;
}
