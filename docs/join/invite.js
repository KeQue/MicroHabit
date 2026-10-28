/* Static invitation bridge. No account lookup, automatic redirect or joining. */
(() => {
  const intro = document.getElementById("intro");
  const invitation = document.getElementById("invitation");
  const codeLabel = document.getElementById("invite-code");
  const openApp = document.getElementById("open-app");
  const copy = document.getElementById("copy-code");
  const status = document.getElementById("status");
  const params = new URLSearchParams(location.search);
  const keys = Array.from(params.keys());
  const raw = params.get("code") ?? "";
  const code = raw.trim();
  if (location.hash || keys.length !== 1 || keys[0] !== "code" ||
      raw.length > 128 || !/^[A-Za-z0-9-]{1,64}$/.test(code)) {
    intro.textContent = "This invitation is incomplete or invalid. Ask your friend to share the invite code again.";
    return;
  }
  const normalized = code.toUpperCase();
  // Matches the installed Expo builder's native route, tested in invite.test.mjs.
  const appLink = new URL("microhabit:///league/join");
  appLink.searchParams.set("code", normalized);
  codeLabel.textContent = normalized;
  openApp.href = appLink.toString();
  openApp.hidden = false;
  invitation.hidden = false;
  intro.textContent = "Your friend shared a league invitation. Use this code to join in Commito.";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      status.textContent = "Invite code copied.";
    } catch {
      status.textContent = "Touch and hold the code above to copy it, or enter it in Commito.";
    }
  });
})();
