"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type HouseholdViewerContextValue = {
  isHouseholdAdmin: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
};

const HouseholdViewerContext = createContext<HouseholdViewerContextValue>({
  isHouseholdAdmin: false,
  householdName: "Your household",
  householdIcon: "",
  userName: "You",
});

export function HouseholdViewerProvider({
  children,
  isHouseholdAdmin,
  householdName,
  householdIcon,
  userName,
}: {
  children: ReactNode;
  isHouseholdAdmin: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
}) {
  return (
    <HouseholdViewerContext.Provider
      value={{
        isHouseholdAdmin,
        householdName,
        householdIcon,
        userName,
      }}
    >
      {children}
    </HouseholdViewerContext.Provider>
  );
}

export const useHouseholdViewer = () => useContext(HouseholdViewerContext);
