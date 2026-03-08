import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccountHeader from "@/app/household/board/components/AccountHeader";

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
  });

  it("renders switch household action when multiple households are available", () => {
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

  it("renders create household action from the account menu", () => {
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
  });
});
