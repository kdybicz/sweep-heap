import AccountDropdown from "@/app/household/board/components/AccountDropdown";

type AccountHeaderProps = {
  canEditHousehold: boolean;
};

export default function AccountHeader({ canEditHousehold }: AccountHeaderProps) {
  return (
    <header className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <div className="flex justify-end">
        <AccountDropdown canEditHousehold={canEditHousehold} />
      </div>
    </header>
  );
}
