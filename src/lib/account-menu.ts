export type AccountShortcut = {
  href: "/household/edit" | "/signout";
  label: "Edit household" | "Sign out";
};

export const getAccountShortcuts = (isHouseholdAdmin: boolean): AccountShortcut[] => {
  if (isHouseholdAdmin) {
    return [
      {
        href: "/household/edit",
        label: "Edit household",
      },
      {
        href: "/signout",
        label: "Sign out",
      },
    ];
  }

  return [
    {
      href: "/signout",
      label: "Sign out",
    },
  ];
};
