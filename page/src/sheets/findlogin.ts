// Find my login. Opt-in: nothing happens until the owner taps the button, nothing is pre-ticked, and the
// page itself never runs anything. A web page cannot see what is installed, so the owner's OWN Websmith
// bot runs page/helper/find-my-login.sh on the owner's own computer and returns one JSON line:
// {"claude":"signed-in|signed-out|not-installed","codex":"..."} (only the sign-in state, never a token).
//  - With a webhook saved: the page sends { op: "find-my-login" } and reads the reply.
//  - Without one: the page shows the message to give the bot, and the owner pastes the bot's reply.
// Then each signed-in tool is a choice ("Found Claude, connect?"). If none is signed in, the page asks
// "Connect through Terminal?" (No is the default) and, only on Yes, shows the sign-in command to run.
import { h } from "../core/dom.ts";
import type { AgentId } from "../core/migrate.ts";
import { settings, updateSettings } from "../core/settings.ts";
import { recordSync } from "../connect/status.ts";
import { callBot, LOGIN_TOOLS, parseLoginReport, type LoginReport, type LoginState, type LoginTool } from "../connect/webhook.ts";
import { button, status } from "./sheet.ts";

const TOOL_NAME: Readonly<Record<LoginTool, string>> = { claude: "Claude", codex: "Codex" };
const APP_NAME: Readonly<Record<LoginTool, string>> = { claude: "Claude Code", codex: "Codex" };
const SIGN_IN: Readonly<Record<LoginTool, string>> = { claude: "claude\n/login", codex: "codex login" };
export const BOT_MESSAGE =
  "Run the find-my-login helper from the Websmith toolkit (page/helper/find-my-login.sh) on my computer and send me the one line it prints.";

function stateText(state: LoginState): string {
  switch (state) {
    case "signed-in":
      return "signed in";
    case "signed-out":
      return "not signed in";
    case "not-installed":
      return "not installed";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function mountFindLogin(): HTMLElement {
  const consent = h("p", {
    class: "sheet-note",
    text: "Find my login asks your own Websmith bot to check, on your computer, whether Claude Code or Codex is signed in. Only that answer comes back: never a password, token or file.",
  });
  const find = button("Find my login");
  const note = status();
  const area = h("div", { class: "sheet-body" });
  const root = h("div", { class: "sheet-body" }, [consent, h("div", { class: "sheet-row" }, [find]), note, area]);

  const say = (text: string, tone: "info" | "error" = "info"): void => {
    note.textContent = text;
    note.dataset["tone"] = tone;
  };

  find.addEventListener("click", () => {
    area.replaceChildren();
    const hook = settings().webhook;
    if (hook === null) {
      say("");
      area.append(...pasteStep(show, say));
      return;
    }
    find.disabled = true;
    say("Asking your bot…");
    void callBot(hook, { op: "find-my-login" }).then((reply) => {
      find.disabled = false;
      const report = reply.ok ? parseLoginReport(reply.value) : reply;
      if (!report.ok) {
        say(report.error, "error");
        return;
      }
      recordSync();
      say("");
      show(report.value);
    });
  });

  function show(report: LoginReport): void {
    area.replaceChildren(h("ul", { class: "sheet-states" }, LOGIN_TOOLS.map((t) => h("li", { text: `${APP_NAME[t]}: ${stateText(report[t])}` }))));
    const found = LOGIN_TOOLS.filter((t) => report[t] === "signed-in");
    for (const tool of found) area.append(foundChoice(tool));
    if (found.length === 0) area.append(terminalQuestion());
  }

  return root;
}

/** No webhook yet: the message for the bot, and a box for its reply. */
function pasteStep(show: (r: LoginReport) => void, say: (text: string, tone?: "info" | "error") => void): HTMLElement[] {
  const message = h("p", { class: "sheet-code", text: BOT_MESSAGE });
  const reply = h("textarea", { class: "field", attrs: { id: "login-reply", rows: "3", spellcheck: "false", autocapitalize: "off" } });
  const check = button("Check", "primary");
  check.addEventListener("click", () => {
    const report = parseLoginReport(reply.value);
    if (!report.ok) {
      say(report.error, "error");
      return;
    }
    say("");
    show(report.value);
  });
  return [
    h("div", { class: "sheet-field" }, [h("label", { text: "Message for your bot" }), message]),
    h("div", { class: "sheet-field" }, [h("label", { text: "Your bot's reply", attrs: { for: "login-reply" } }), reply]),
    h("div", { class: "sheet-row" }, [check]),
  ];
}

/** "Found Claude, connect?": the owner's choice. Connect remembers it here and tells their bot. */
function foundChoice(tool: LoginTool): HTMLElement {
  const yes = button("Connect", "primary");
  const no = button("Not now");
  const note = status();
  const box = h("div", { class: "sheet-found" }, [h("p", { text: `Found ${TOOL_NAME[tool]}, connect?` }), h("div", { class: "sheet-row" }, [yes, no]), note]);
  if (settings().agents.includes(tool)) note.textContent = `${TOOL_NAME[tool]} is connected.`;
  no.addEventListener("click", () => box.remove());
  yes.addEventListener("click", () => {
    const agents: AgentId[] = [...settings().agents.filter((a) => a !== tool), tool];
    updateSettings({ agents });
    note.textContent = `${TOOL_NAME[tool]} is connected.`;
    const hook = settings().webhook;
    if (hook !== null) {
      void callBot(hook, { op: "connect-agent", agent: tool }).then((r) => {
        if (r.ok) recordSync();
        else note.textContent = `${TOOL_NAME[tool]} is connected here. ${r.error}`;
      });
    }
  });
  return box;
}

/** Nothing signed in: ask first. No is the default; nothing happens without Yes. */
function terminalQuestion(): HTMLElement {
  const yes = button("Yes");
  const no = button("No", "primary");
  const after = h("div", { class: "sheet-body" });
  const box = h("div", { class: "sheet-found", attrs: { role: "group", "aria-labelledby": "terminal-q" } }, [
    h("p", { text: "Connect through Terminal?", attrs: { id: "terminal-q" } }),
    h("p", { class: "sheet-note", text: "Connecting through Terminal lets Websmith control your AI agents (like Claude Code or Codex) for you." }),
    h("div", { class: "sheet-row" }, [no, yes]),
    after,
  ]);
  no.addEventListener("click", () => box.remove());
  yes.addEventListener("click", () => {
    const pick = LOGIN_TOOLS.map((t) => {
      const b = button(APP_NAME[t]);
      b.addEventListener("click", () => {
        after.replaceChildren(
          h("p", { text: `Sign in to ${APP_NAME[t]} yourself, in Terminal:` }),
          h("p", { class: "sheet-code", text: SIGN_IN[t] }),
        );
      });
      return b;
    });
    after.replaceChildren(h("div", { class: "sheet-row" }, pick));
  });
  queueMicrotask(() => no.focus()); // the safe answer has focus
  return box;
}
