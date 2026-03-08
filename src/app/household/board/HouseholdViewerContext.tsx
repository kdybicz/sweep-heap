"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type HouseholdViewerContextValue = {
  canSwitchHouseholds: boolean;
  isHouseholdAdmin: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
};

const HouseholdViewerContext = createContext<HouseholdViewerContextValue>({
  canSwitchHouseholds: false,
  isHouseholdAdmin: false,
  householdName: "Your household",
  householdIcon: "",
  userName: "You",
});

export function HouseholdViewerProvider({
  canSwitchHouseholds,
  children,
  isHouseholdAdmin,
  householdName,
  householdIcon,
  userName,
}: {
  canSwitchHouseholds: boolean;
  children: ReactNode;
  isHouseholdAdmin: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
}) {
  return (
    <HouseholdViewerContext.Provider
      value={{
        canSwitchHouseholds,
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
