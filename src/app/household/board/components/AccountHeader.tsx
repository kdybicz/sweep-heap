import AccountDropdown from "@/app/household/board/components/AccountDropdown";
import HouseholdDropdown from "@/app/household/board/components/HouseholdDropdown";

const householdHeadingId = "household-board-current-household-heading";
const headerDropdownGroupName = "household-board-header";

type AccountHeaderProps = {
  canEditHousehold: boolean;
  canSwitchHouseholds: boolean;
  householdName: string;
  householdIcon: string;
  userName: string;
};

export default function AccountHeader({
  canEditHousehold,
  canSwitchHouseholds,
  householdName,
  householdIcon,
  userName,
}: AccountHeaderProps) {
  const title = householdName.trim() || "Your household";
  const icon = householdIcon.trim();

  return (
    <header className="relative z-30 overflow-visible border border-[var(--stroke)] bg-[color-mix(in_srgb,var(--surface)_86%,white_14%)] px-4 pb-3 pt-4 shadow-[var(--shadow-soft)] sm:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,var(--accent-secondary),var(--accent),var(--accent-tertiary))]" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="sr-only" id={householdHeadingId}>
            Current household: {title}
          </h2>
          <HouseholdDropdown
            canEditHousehold={canEditHousehold}
            canSwitchHouseholds={canSwitchHouseholds}
            dropdownGroupName={headerDropdownGroupName}
            householdIcon={icon}
            householdName={title}
          />
        </div>
        <div className="shrink-0">
          <AccountDropdown dropdownGroupName={headerDropdownGroupName} userName={userName} />
        </div>
      </div>
    </header>
  );
}
