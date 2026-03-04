import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccountHeader from "@/app/household/board/components/AccountHeader";

describe("AccountHeader", () => {
  it("does not render a fallback household icon when icon is empty", () => {
    const markup = renderToStaticMarkup(
      <AccountHeader
        canEditHousehold
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
        householdIcon="🧺"
        householdName="Flat 4"
        userName="Jane Doe"
      />,
    );

    expect(markup).toContain(">🧺<");
    expect(markup).toContain(">JD<");
  });
});
