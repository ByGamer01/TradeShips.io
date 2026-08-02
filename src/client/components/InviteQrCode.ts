import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { qrToSvg } from "../utilities/QrCode";

/**
 * Renders an invite URL as a scannable QR code. The URL is app-generated
 * (never user input), so inlining the produced SVG is safe.
 */
@customElement("invite-qr-code")
export class InviteQrCode extends LitElement {
  @property({ type: String }) url = "";

  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.url) {
      return html``;
    }
    let svg: string;
    try {
      svg = qrToSvg(this.url);
    } catch (err) {
      console.warn("Failed to render invite QR code", err);
      return html``;
    }
    return html`
      <div class="rounded-lg overflow-hidden bg-white p-1 [&>svg]:block [&>svg]:w-full [&>svg]:h-full">
        ${unsafeSVG(svg)}
      </div>
    `;
  }
}
