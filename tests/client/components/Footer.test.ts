import {
  OPENFRONT_COPYRIGHT_NOTICE,
  TRADESHIPS_COPYRIGHT_NOTICE,
} from "../../../src/client/Attribution";
import { Footer } from "../../../src/client/components/Footer";

describe("page-footer attribution", () => {
  let footer: Footer;

  beforeEach(async () => {
    if (!customElements.get("page-footer")) {
      customElements.define("page-footer", Footer);
    }
    footer = document.createElement("page-footer") as Footer;
    document.body.appendChild(footer);
    await footer.updateComplete;
  });

  afterEach(() => {
    footer.remove();
  });

  function notice(name: string): HTMLElement {
    const el = footer.querySelector<HTMLElement>(
      `[data-attribution="${name}"]`,
    );
    expect(el, `missing [data-attribution="${name}"]`).not.toBeNull();
    return el!;
  }

  test("renders the exact OpenFront copyright notice", () => {
    expect(notice("openfront").textContent?.trim()).toBe(
      OPENFRONT_COPYRIGHT_NOTICE,
    );
  });

  test("renders TradeShips' own copyright notice", () => {
    expect(notice("tradeships").textContent?.trim()).toBe(
      TRADESHIPS_COPYRIGHT_NOTICE,
    );
  });

  test("notices are not driven by data-i18n", () => {
    expect(notice("openfront").closest("[data-i18n]")).toBeNull();
    expect(notice("tradeships").closest("[data-i18n]")).toBeNull();
  });

  test("the copyright line is one size step larger and high-contrast", () => {
    const line = notice("openfront").closest("p");
    expect(line).not.toBeNull();
    // Previously text-xs (12px) at the footer's text-white/50.
    expect(line!.classList.contains("text-sm")).toBe(true);
    expect(line!.classList.contains("text-white/70")).toBe(true);
  });

  test("on phones every notice gets a row of its own, with no separators", () => {
    // Below Tailwind's sm breakpoint the line wraps. Whether the first two
    // items share a row depends on locale and width (e.g. English at 360px
    // does not fit), so stack all three and hide every "·" to avoid one
    // dangling at a row edge. jsdom has no layout, so assert the classes.
    const line = notice("openfront").closest("p")!;
    const items = Array.from(line.children) as HTMLElement[];
    const separators = items.filter(
      (el) => el.getAttribute("aria-hidden") === "true",
    );
    const texts = items.filter((el) => !separators.includes(el));

    expect(separators).toHaveLength(2);
    for (const sep of separators) {
      expect(sep.textContent?.trim()).toBe("·");
      expect(sep.classList.contains("hidden")).toBe(true);
      expect(sep.classList.contains("sm:inline")).toBe(true);
    }

    expect(texts).toHaveLength(3);
    expect(texts[0]).toBe(notice("tradeships"));
    expect(texts[1].getAttribute("data-i18n")).toBe(
      "game_starting_modal.based_on",
    );
    expect(texts[2]).toBe(notice("openfront"));
    for (const text of texts) {
      expect(text.classList.contains("basis-full")).toBe(true);
      expect(text.classList.contains("sm:basis-auto")).toBe(true);
    }
  });

  test("links the AGPL-3.0 license next to the legal links", () => {
    const link = footer.querySelector<HTMLAnchorElement>(
      '[data-attribution="license"]',
    );
    expect(link).not.toBeNull();
    expect(link!.textContent?.trim()).toBe("AGPL-3.0");
    expect(link!.href).toBe(
      "https://github.com/ByGamer01/TradeShips.io/blob/main/LICENSE",
    );
    expect(link!.rel).toContain("noopener");
  });

  test("a translation pass cannot overwrite the OpenFront notice", () => {
    // Mimic LangSelector.translatePage(): it replaces the textContent of
    // every [data-i18n] element with the translated string.
    footer.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = "translated";
    });

    expect(notice("openfront").textContent?.trim()).toBe(
      OPENFRONT_COPYRIGHT_NOTICE,
    );
  });
});
