import AccountDropdown from "@/app/household/board/components/AccountDropdown";

type AccountHeaderProps = {
  canEditHousehold: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
};

export default function AccountHeader({
  canEditHousehold,
  householdName,
  householdIcon,
  userName,
}: AccountHeaderProps) {
  const title = householdName.trim() || "Your household";
  const icon = householdIcon.trim();

  return (
    <header className="py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          {icon ? (
            <span className="text-base leading-none" aria-hidden>
              {icon}
            </span>
          ) : null}
          <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</h2>
          <span className="hidden rounded-full border border-[var(--stroke-soft)] bg-[var(--surface-weak)] px-1.5 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] md:inline-flex">
            {canEditHousehold ? "Admin" : "Member"}
          </span>
        </div>
        <div className="shrink-0">
          <AccountDropdown canEditHousehold={canEditHousehold} userName={userName} />
        </div>
      </div>
    </header>
  );
}
