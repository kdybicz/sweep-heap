import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import UserDetailsEditForm from "@/app/user/edit/UserDetailsEditForm";

describe("UserDetailsEditForm", () => {
  it("renders editable name with read-only email and timezone fields", () => {
    const markup = renderToStaticMarkup(
      <UserDetailsEditForm
        email="alex@example.com"
        householdTimeZone="Europe/Warsaw"
        initialName="Alex"
      />,
    );

    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="Alex"/);
    expect(markup).toMatch(/<input[^>]*type="email"[^>]*readOnly=""[^>]*value="alex@example.com"/);
    expect(markup).toMatch(/<select[^>]*disabled=""[^>]*>/);
    expect(markup).toContain(">Europe/Warsaw</option>");
  });

  it("includes current timezone when it is not in the preset list", () => {
    const markup = renderToStaticMarkup(
      <UserDetailsEditForm
        email="alex@example.com"
        householdTimeZone="Mars/Olympus"
        initialName="Alex"
      />,
    );

    expect(markup).toContain('<option value="Mars/Olympus" selected="">Mars/Olympus</option>');
  });
});
