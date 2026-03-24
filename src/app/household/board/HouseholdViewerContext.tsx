"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type HouseholdViewerContextValue = {
  canSwitchHouseholds: boolean;
  canManageChores: boolean;
  isHouseholdAdmin: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
};

const HouseholdViewerContext = createContext<HouseholdViewerContextValue>({
  canSwitchHouseholds: false,
  canManageChores: true,
  isHouseholdAdmin: false,
  householdName: "Your household",
  householdIcon: "",
  userName: "You",
});

export function HouseholdViewerProvider({
  canSwitchHouseholds,
  canManageChores,
  children,
  isHouseholdAdmin,
  householdName,
  householdIcon,
  userName,
}: {
  canSwitchHouseholds: boolean;
  canManageChores: boolean;
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
        canManageChores,
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
