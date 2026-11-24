import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";
import { Card } from "./card";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("shared shadcn primitives", () => {
  it("composes a link without nesting a button", () => {
    const html = renderToStaticMarkup(createElement(Button, { asChild: true },
      createElement("a", { href: "/library" }, "Open library"),
    ));
    expect(html).toContain('<a href="/library"');
    expect(html).toContain('data-slot="button"');
    expect(html).not.toContain("<button");
  });

  it("keeps mobile buttons touch-sized and desktop buttons compact", () => {
    expect(buttonVariants()).toContain("h-11");
    expect(buttonVariants()).toContain("md:h-9");
    expect(buttonVariants({ size: "sm" })).toContain("md:h-8");
    expect(buttonVariants({ variant: "accent" })).toContain("bg-accent");
  });

  it("preserves input attributes and the surface token", () => {
    const html = renderToStaticMarkup(createElement(Input, {
      id: "email", type: "email", required: true, "aria-invalid": true,
    }));
    expect(html).toContain('type="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("bg-surface");
  });

  it("uses the rounded flat card and reduced-motion skeleton styles", () => {
    const card = renderToStaticMarkup(createElement(Card, null, "Study desk"));
    expect(card).toContain("rounded-xl");
    expect(card).not.toContain("shadow");
    expect(renderToStaticMarkup(createElement(Skeleton))).toContain("motion-reduce:animate-none");
  });

  it("connects Radix tab triggers to the active study panel", () => {
    const html = renderToStaticMarkup(createElement(Tabs, { value: "overview" },
      createElement(TabsList, { "aria-label": "Study workspace" },
        createElement(TabsTrigger, { value: "overview" }, "Overview"),
        createElement(TabsTrigger, { value: "topics" }, "Topics"),
      ),
      createElement(TabsContent, { value: "overview" }, "Document overview"),
    ));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Study workspace"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Document overview");
  });
});
