export type AccountShortcut = {
  href: "/user/edit" | "/household/edit" | "/signout";
  label: "Edit profile" | "Edit household" | "Sign out";
};

export const getAccountShortcuts = (isHouseholdAdmin: boolean): AccountShortcut[] => {
  if (isHouseholdAdmin) {
    return [
      {
        href: "/user/edit",
        label: "Edit profile",
      },
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
      href: "/user/edit",
      label: "Edit profile",
    },
    {
      href: "/signout",
      label: "Sign out",
    },
  ];
};
