export type AccountShortcut = {
  href: "/user/edit" | "/settings" | "/signout";
  label: "Profile" | "Settings" | "Sign out";
};

export const getAccountShortcuts = (): AccountShortcut[] => {
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
