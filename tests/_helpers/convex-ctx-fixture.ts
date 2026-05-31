import { vi } from "vitest";
import type { MutationCtx, QueryCtx } from "../../convex/_generated/server.js";

type DbMethods = Pick<
  MutationCtx["db"],
  "get" | "insert" | "patch" | "delete" | "query"
>;

export type FakeDb = {
  [K in keyof DbMethods]: ReturnType<typeof vi.fn>;
};

export const createFakeMutationDb = (): FakeDb => ({
  get: vi.fn(),
  insert: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  query: vi.fn(),
});

export const asMutationDb = (fake: FakeDb): MutationCtx["db"] =>
  fake as unknown as MutationCtx["db"];

export const asQueryDb = (fake: Omit<FakeDb, "insert" | "patch" | "delete">): QueryCtx["db"] =>
  fake as unknown as QueryCtx["db"];
