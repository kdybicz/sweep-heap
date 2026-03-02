"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type HeapViewerContextValue = {
  isHouseholdAdmin: boolean;
};

const HeapViewerContext = createContext<HeapViewerContextValue>({
  isHouseholdAdmin: false,
});

export function HeapViewerProvider({
  children,
  isHouseholdAdmin,
}: {
  children: ReactNode;
  isHouseholdAdmin: boolean;
}) {
  return (
    <HeapViewerContext.Provider value={{ isHouseholdAdmin }}>{children}</HeapViewerContext.Provider>
  );
}

export const useHeapViewer = () => useContext(HeapViewerContext);
