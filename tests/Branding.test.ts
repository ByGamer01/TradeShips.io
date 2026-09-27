import fs from "fs";
import path from "path";
import {
  OPENFRONT_COPYRIGHT_NOTICE,
  TRADESHIPS_COPYRIGHT_NOTICE,
} from "../src/client/Attribution";

const ROOT = path.join(__dirname, "..");

// Every screen where upstream OpenFront shows its copyright notice.
const ATTRIBUTION_SURFACES = ["src/client/components/Footer.ts"];

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("TradeShips.io phase 1 branding", () => {
  test("updates visible brand metadata without changing deferred URLs", () => {
    const indexHtml = readText("index.html");

    expect(indexHtml).toContain(
      '<title data-i18n="main.title">TradeShips.io (ALPHA)</title>',
    );
    expect(indexHtml).toContain(
      'content="Command a naval fleet and dominate the seas in this fast-paced multiplayer strategy IO game. Expand your maritime domain, outmaneuver rivals, and rule the oceans."',
    );
    expect(indexHtml).toContain(
      'property="og:title" content="TradeShips.io — Naval Strategy"',
    );
    expect(indexHtml).toContain(
      'content="Command your fleet, expand across the seas, and outmaneuver rivals in this fast-paced multiplayer naval IO game."',
    );

    expect(indexHtml).toContain('rel="canonical" href="https://openfront.io/"');
    expect(indexHtml).toContain(
      'property="og:url" content="https://openfront.io/"',
    );
  });

  test("updates PWA manifest brand", () => {
    const manifest = JSON.parse(readText("resources/manifest.json")) as {
      name: string;
      short_name: string;
    };

    expect(manifest.name).toBe("TradeShips.io");
    expect(manifest.short_name).toBe("TradeShips");
  });

  test("updates scoped i18n strings", () => {
    const en = JSON.parse(readText("resources/lang/en.json")) as {
      main: { title: string };
      news_box: { firefox_warning: string };
    };

    expect(en.main.title).toBe("TradeShips.io (ALPHA)");
    expect(en.news_box.firefox_warning).toContain("TradeShips.io");
  });

  describe("AGPL-3.0 Section 7(b) attribution", () => {
    test("the OpenFront notice is the exact string LICENSE requires", () => {
      expect(OPENFRONT_COPYRIGHT_NOTICE).toBe("© OpenFront and Contributors");
      // U+00A9, no trademark sign (U+2122), no emoji variation selector.
      expect(OPENFRONT_COPYRIGHT_NOTICE.codePointAt(0)).toBe(0xa9);
      expect(OPENFRONT_COPYRIGHT_NOTICE).not.toContain("™");
      expect(OPENFRONT_COPYRIGHT_NOTICE).not.toContain("️");
      expect(readText("LICENSE")).toContain(`"${OPENFRONT_COPYRIGHT_NOTICE}"`);
    });

    test("TradeShips' own notice never carries a trademark sign", () => {
      expect(TRADESHIPS_COPYRIGHT_NOTICE).toBe("© TradeShips and Contributors");
      expect(TRADESHIPS_COPYRIGHT_NOTICE).not.toContain("™");
      expect(TRADESHIPS_COPYRIGHT_NOTICE).not.toContain("️");
    });

    test("copyright notices are rendered from constants, not i18n", () => {
      // A translation must never be able to alter or drop the notice, so it
      // has no en.json key and the UI imports the constant instead.
      const en = JSON.parse(readText("resources/lang/en.json")) as {
        main: Record<string, string>;
      };
      expect(en.main).not.toHaveProperty("copyright");

      for (const file of ATTRIBUTION_SURFACES) {
        const source = readText(file);
        expect(source, file).not.toContain("main.copyright");
        expect(source, file).toContain("OPENFRONT_COPYRIGHT_NOTICE");
      }
    });
  });

  test("uses the naval palette and removes the old primary blue literals", () => {
    const styles = readText("src/client/styles.css");

    expect(styles).toContain("--color-malibu-blue: #1b7f9e;");
    expect(styles).toContain("--color-aquarius: #4db6c9;");
    expect(styles).toContain("--color-dawn-blue: #b7c4cc;");
    expect(styles).toContain("--color-cyber-yellow: #e9c46a;");
    expect(styles).toContain("--color-limestone: #8a97a3;");
    expect(styles).toContain("--color-hex-cyan: #2fb6cc;");
    expect(styles).toContain("--color-frame-orange: #ee6c4d;");

    expect(styles).not.toContain("#0084d1");
    expect(styles).not.toContain("rgba(0, 132, 209");
  });

  test("uses the naval outgoing attack color in canvas controllers", () => {
    const controller = readText(
      "src/client/controllers/AttackingTroopsController.ts",
    );

    expect(controller).toContain("Aquarius (#4db6c9)");
    expect(controller).not.toContain("#3fa9f5");
  });
});
