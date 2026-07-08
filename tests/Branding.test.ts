import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("TradeShips.io phase 1 branding", () => {
  test("updates visible brand metadata without changing deferred URLs", () => {
    const indexHtml = readText("index.html");

    expect(indexHtml).toContain(
      "<title data-i18n=\"main.title\">TradeShips.io (ALPHA)</title>",
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

  test("updates scoped i18n strings while preserving AGPL attribution", () => {
    const en = JSON.parse(readText("resources/lang/en.json")) as {
      main: { copyright: string; title: string };
      news_box: { firefox_warning: string };
    };

    expect(en.main.title).toBe("TradeShips.io (ALPHA)");
    expect(en.news_box.firefox_warning).toContain("TradeShips.io");
    expect(en.main.copyright).toBe("© OpenFront™ and Contributors");
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
    const controller = readText("src/client/controllers/AttackingTroopsController.ts");

    expect(controller).toContain("Aquarius (#4db6c9)");
    expect(controller).not.toContain("#3fa9f5");
  });
});
