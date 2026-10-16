import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";

export const renderEmailTemplate = async (template: ReactElement) => {
  const html = await render(template);
  return { html, text: toPlainText(html) };
};
