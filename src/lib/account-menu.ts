export type AccountShortcut = {
  href: "/user/edit" | "/settings" | "/household/edit" | "/household/members" | "/signout";
  label: "Profile" | "Settings" | "Household" | "Members" | "Sign out";
};

export const getAccountShortcuts = (isHouseholdAdmin: boolean): AccountShortcut[] => {
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
      href: "/signout",
      label: "Sign out",
    },
  ];
};
