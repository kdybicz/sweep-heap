import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppearanceSettingsForm from "@/app/settings/AppearanceSettingsForm";

describe("AppearanceSettingsForm", () => {
  it("renders theme choices and defaults to system", () => {
    const markup = renderToStaticMarkup(<AppearanceSettingsForm />);

    expect(markup).toContain("Appearance");
    expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="system"/);
    expect(markup).toMatch(/<input[^>]*value="light"/);
    expect(markup).toMatch(/<input[^>]*value="dark"/);
  });
});
