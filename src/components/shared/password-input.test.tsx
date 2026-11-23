import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("starts concealed and exposes a non-submit visibility control", () => {
    const html = renderToStaticMarkup(
      <PasswordInput id="password" name="password" autoComplete="current-password" required />,
    );

    expect(html).toContain('type="password"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-controls="password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('required=""');
  });

  it("preserves registration constraints and disables both controls during requests", () => {
    const html = renderToStaticMarkup(
      <PasswordInput
        id="password"
        autoComplete="new-password"
        aria-describedby="password-hint"
        minLength={8}
        className="h-12"
        disabled
      />,
    );

    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('aria-describedby="password-hint"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain("h-12");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
