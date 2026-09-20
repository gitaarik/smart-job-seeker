/**
 * Typed access to the drizzle spies a test has installed with `vi.mock`.
 *
 * Drizzle's own signature is what the module under test sees; here it is a
 * spy, and saying so once beats casting at every call site. These return
 * `Mock` rather than `any` so the mock API stays in view and everything else
 * stays out — and unlike `vi.mocked`, they do not also demand that a fixture
 * satisfy the real row type, which is the point of a partial fixture.
 */
import type { Mock } from 'vitest';

/** The mocked `findFirst` for one table. */
export const findFirst = (table: { findFirst: unknown }): Mock => table.findFirst as Mock;

/** The mocked `findMany` for one table. */
export const findMany = (table: { findMany: unknown }): Mock => table.findMany as Mock;

/** A mocked method on `db` itself, such as `insert`, whose builder type shares nothing with a spy. */
export const asMock = (method: unknown): Mock => method as Mock;
