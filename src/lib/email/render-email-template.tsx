import { render } from "@react-email/render";
import type { ReactElement } from "react";

export const renderEmailTemplate = async (template: ReactElement) => {
  const [html, text] = await Promise.all([
    render(template),
    render(template, {
      plainText: true,
    }),
  ]);

  return { html, text };
};
