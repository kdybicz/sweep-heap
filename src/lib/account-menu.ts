export type AccountShortcut = {
  href: "/user/edit" | "/settings" | "/household/edit" | "/signout";
  label: "Profile" | "Settings" | "Household" | "Sign out";
};

export const getAccountShortcuts = (isHouseholdAdmin: boolean): AccountShortcut[] => {
  if (isHouseholdAdmin) {
    return [
      {
        href: "/user/edit",
        label: "Profile",
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
      href: "/settings",
      label: "Settings",
    },
    {
      href: "/signout",
      label: "Sign out",
    },
  ];
};
