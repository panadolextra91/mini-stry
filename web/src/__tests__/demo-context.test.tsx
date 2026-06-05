import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDemoContext } from "../app/context/DemoContext";

describe("useDemoContext", () => {
  it("throws when used outside DemoProvider", () => {
    expect(() => {
      renderHook(() => useDemoContext());
    }).toThrow("useDemoContext must be used within a DemoProvider");
  });
});
