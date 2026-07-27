import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Every spec renders into the same jsdom document; tear it down between tests
// so a stray provider from one case can't satisfy a query in the next.
afterEach(cleanup);
