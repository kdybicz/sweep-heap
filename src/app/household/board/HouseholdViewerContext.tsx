"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type HouseholdViewerContextValue = {
  isHouseholdAdmin: boolean;
};

const HouseholdViewerContext = createContext<HouseholdViewerContextValue>({
  isHouseholdAdmin: false,
});

export function HouseholdViewerProvider({
  children,
  isHouseholdAdmin,
}: {
  children: ReactNode;
  isHouseholdAdmin: boolean;
}) {
  return (
    <HouseholdViewerContext.Provider value={{ isHouseholdAdmin }}>
      {children}
    </HouseholdViewerContext.Provider>
  );
}

export const useHouseholdViewer = () => useContext(HouseholdViewerContext);
