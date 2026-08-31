import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { resolveLocale, setLocale } from "@/i18n";

// Every spec renders into the same jsdom document; tear it down between tests
// so a stray provider from one case can't satisfy a query in the next.
afterEach(cleanup);

// The locale is module state, not context, so it survives cleanup — a case
// that switches language would otherwise leave every later one rendering in
// it. Back to what a fresh launcher would pick.
afterEach(() => setLocale(resolveLocale("")));

// jsdom has no layout, so it ships no scrollIntoView — which Radix's Select
// calls the moment a listbox opens. Without it, opening any picker in a test
// throws before the options are ever queryable.
Element.prototype.scrollIntoView ??= () => {};
