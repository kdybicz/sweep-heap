import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccountHeader from "@/app/household/board/components/AccountHeader";

const getDropdownSections = (markup: string) => markup.match(/<details[\s\S]*?<\/details>/g) ?? [];

describe("AccountHeader", () => {
  it("does not render a fallback household icon when icon is empty", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold
        canSwitchHouseholds={false}
        householdIcon=""
        householdName="Sunday Crew"
        userName="Jane Doe"
      />,
    );

    expect(markup).toContain("Sunday Crew");
    expect(markup).toContain("<h2");
    expect(markup).toContain("Current household: Sunday Crew");
    expect(markup).not.toContain("text-base leading-none");
    expect(markup).not.toContain(">🏡<");
  });

  it("renders provided household icon and user initials", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold={false}
        canSwitchHouseholds={false}
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );

    expect(markup).toContain(">🧺<");
    expect(markup).toContain(">JD<");
    expect(markup).toContain("Current household");
  });

  it("renders switch household action in the household menu when multiple households are available", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold={false}
        canSwitchHouseholds
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );

    expect(markup).toContain("Switch household");
    expect(markup).toContain("/household/select");
  });

  it("renders create household action from the household menu", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold={false}
        canSwitchHouseholds={false}
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );

    expect(markup).toContain("Create household");
    expect(markup).toContain("/household/setup");
    expect(markup).not.toContain("Household</a>");
  });

  it("renders members in the household menu", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold={false}
        canSwitchHouseholds={false}
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );
    const [householdDropdown, accountDropdown] = getDropdownSections(markup);

    expect(householdDropdown).toContain("Members");
    expect(householdDropdown).toContain("/household/members");
    expect(accountDropdown).not.toContain("/household/members");
  });

  it("keeps the account menu focused on personal actions", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold
        canSwitchHouseholds
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );
    const [householdDropdown, accountDropdown] = getDropdownSections(markup);

    expect(householdDropdown).toContain("Edit household");
    expect(householdDropdown).toContain("Create household");
    expect(householdDropdown).toContain("Switch household");
    expect(accountDropdown).toContain("Profile");
    expect(accountDropdown).toContain("Settings");
    expect(accountDropdown).toContain("Sign out");
    expect(accountDropdown).not.toContain("Create household");
    expect(accountDropdown).not.toContain("Switch household");
  });
});
