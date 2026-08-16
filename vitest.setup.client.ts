/**
 * Setup for the `client` (jsdom) test project.
 *
 * Registers testing-library's cleanup between tests. Without it every render
 * accumulates in one jsdom document for the whole file, so a later
 * `queryByText(...)` reads markup an earlier test left behind — failing on
 * correct code, or worse, passing for the wrong reason. The project ran with
 * no setupFiles at all until a second component test tripped over it; the
 * first one only escaped because each of its assertions happened to query text
 * unique to that case.
 *
 * Deliberately separate from `vitest.setup.ts`, which mocks the database and
 * server env for the node project and has no business loading in a browser
 * environment.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(cleanup);
