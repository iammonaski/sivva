import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudyText } from "./study-text";

// These are boundary inputs, not mocked application data.
describe("StudyText", () => {
  it("renders study headings, lists and emphasis", () => {
    const html = renderToStaticMarkup(<StudyText text={"## Key concepts\n\n- **Definition**\n- `Formula`"} />);
    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("<strong>Definition</strong>");
    expect(html).toContain("Formula</code>");
  });

  it("escapes model HTML and does not create remote links", () => {
    const html = renderToStaticMarkup(<StudyText text={'<script>alert(1)</script>\n\n[Open](javascript:alert(1))'} />);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;script&gt;");
  });
});
