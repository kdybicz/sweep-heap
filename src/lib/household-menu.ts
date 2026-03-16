export type HouseholdShortcut = {
  href: "/household/edit" | "/household/members" | "/household/setup" | "/household/select";
  label: "Edit household" | "Members" | "Create household" | "Switch household";
};

export const getHouseholdShortcuts = (
  isHouseholdAdmin: boolean,
  canSwitchHouseholds: boolean,
): HouseholdShortcut[] => {
  const shortcuts: HouseholdShortcut[] = [];

  if (isHouseholdAdmin) {
    shortcuts.push({
      href: "/household/edit",
      label: "Edit household",
    });
  }

  shortcuts.push({
    href: "/household/members",
    label: "Members",
  });

  shortcuts.push({
    href: "/household/setup",
    label: "Create household",
  });

  if (canSwitchHouseholds) {
    shortcuts.push({
      href: "/household/select",
      label: "Switch household",
    });
  }

  return shortcuts;
};
