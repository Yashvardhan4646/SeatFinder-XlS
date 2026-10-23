import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { Spotlight } from "@/components/ui/spotlight";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

describe("Aceternity UI Components", () => {
  it("renders Spotlight without crashing", () => {
    const html = renderToString(<Spotlight className="test-spotlight" fill="#6366F1" />);
    expect(html).toContain("animate-spotlight");
    expect(html).toContain("test-spotlight");
    expect(html).toContain("#6366F1");
  });

  it("renders CardSpotlight and its children", () => {
    const html = renderToString(
      <CardSpotlight radius={300} color="rgba(99, 102, 241, 0.1)">
        <div>Spotlight Content</div>
      </CardSpotlight>
    );
    expect(html).toContain("Spotlight Content");
    expect(html).toContain("group/spotlight");
  });

  it("renders HoverBorderGradient button with children", () => {
    const html = renderToString(
      <HoverBorderGradient as="button">
        <span>Contribute</span>
      </HoverBorderGradient>
    );
    expect(html).toContain("Contribute");
  });
});
