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
