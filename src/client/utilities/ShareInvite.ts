import { copyToClipboard, showToast, translateText } from "../Utils";

/**
 * Traffic-source tag appended to every invite link we generate, so acquisition
 * per channel shows up in server access logs (`?ref=<channel>`).
 */
export type InviteRef = "lobby" | "qr" | "win" | "party" | "rematch";

/** Append `ref=<channel>` to a URL without disturbing existing params. */
export function withRefParam(url: string, ref: InviteRef): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("ref", ref);
    return parsed.toString();
  } catch {
    return url;
  }
}

export interface ShareInviteOptions {
  text: string;
  url: string;
}

export type ShareInviteResult = "shared" | "copied" | "failed";

/**
 * Share an invite through the native share sheet when available (mobile),
 * falling back to copying "<text> <url>" to the clipboard with a toast.
 */
export async function shareInvite(
  options: ShareInviteOptions,
): Promise<ShareInviteResult> {
  const payload = { text: options.text, url: options.url };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      // AbortError means the user dismissed the sheet — not a failure worth
      // falling back on; anything else falls through to the clipboard.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "failed";
      }
    }
  }

  let copied = false;
  await copyToClipboard(`${options.text} ${options.url}`, () => {
    copied = true;
  });
  if (copied) {
    showToast(translateText("share.link_copied"), "green");
    return "copied";
  }
  showToast(translateText("share.failed"), "red");
  return "failed";
}
