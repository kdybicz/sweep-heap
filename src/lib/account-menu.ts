export type AccountShortcut = {
  href:
    | "/user/edit"
    | "/settings"
    | "/household/edit"
    | "/household/members"
    | "/household/setup"
    | "/household/select"
    | "/signout";
  label:
    | "Profile"
    | "Settings"
    | "Household"
    | "Members"
    | "Create household"
    | "Switch household"
    | "Sign out";
};

export const getAccountShortcuts = (
  isHouseholdAdmin: boolean,
  canSwitchHouseholds: boolean,
): AccountShortcut[] => {
  const switchShortcut = canSwitchHouseholds
    ? [
        {
          href: "/household/select" as const,
          label: "Switch household" as const,
        },
      ]
    : [];

  if (isHouseholdAdmin) {
    return [
      {
        href: "/user/edit",
        label: "Profile",
      },
      {
        href: "/household/members",
        label: "Members",
      },
      {
        href: "/household/edit",
        label: "Household",
      },
      {
        href: "/settings",
        label: "Settings",
      },
      {
        href: "/household/setup",
        label: "Create household",
      },
      ...switchShortcut,
      {
        href: "/signout",
        label: "Sign out",
      },
    ];
  }

  return [
    {
      href: "/user/edit",
      label: "Profile",
    },
    {
      href: "/household/members",
      label: "Members",
    },
    {
      href: "/settings",
      label: "Settings",
    },
    {
      href: "/household/setup",
      label: "Create household",
    },
    ...switchShortcut,
    {
      href: "/signout",
      label: "Sign out",
    },
  ];
};
