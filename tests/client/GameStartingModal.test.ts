import { OPENFRONT_COPYRIGHT_NOTICE } from "../../src/client/Attribution";
import { GameStartingModal } from "../../src/client/GameStartingModal";

// Return the raw key so any text that came from i18n is easy to spot.
vi.mock("../../src/client/Utils", () => ({
  translateText: vi.fn((key: string) => key),
}));

describe("game-starting-modal attribution", () => {
  let modal: GameStartingModal;

  beforeEach(async () => {
    if (!customElements.get("game-starting-modal")) {
      customElements.define("game-starting-modal", GameStartingModal);
    }
    modal = document.createElement("game-starting-modal") as GameStartingModal;
    document.body.appendChild(modal);
    modal.show();
    await modal.updateComplete;
  });

  afterEach(() => {
    modal.remove();
  });

  function openFrontNotice(): HTMLElement {
    const el = modal.querySelector<HTMLElement>(
      '[data-attribution="openfront"]',
    );
    expect(el, 'missing [data-attribution="openfront"]').not.toBeNull();
    return el!;
  }

  test("renders the exact OpenFront copyright notice from the constant", () => {
    expect(openFrontNotice().textContent?.trim()).toBe(
      OPENFRONT_COPYRIGHT_NOTICE,
    );
    expect(openFrontNotice().closest("[data-i18n]")).toBeNull();
  });

  test("the notice is not rendered in uppercase", () => {
    // Keeps the on-screen text identical to the string LICENSE requires.
    expect(openFrontNotice().className).not.toMatch(/\buppercase\b/);
  });

  test("the notice is at least as large as the surrounding license text", () => {
    // Tailwind text-base = 16px, same as the AGPL-3.0 license line below it.
    expect(openFrontNotice().classList.contains("text-base")).toBe(true);
  });
});
