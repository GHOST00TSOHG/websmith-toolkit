// Dev server on the first free port from 5183 up. Never 4191 or 4291.
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const FORBIDDEN = new Set([4191, 4291]);

function isFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => done(true)));
  });
}

let port = 5183;
while (FORBIDDEN.has(port) || !(await isFree(port))) port += 1;

console.log(`Dev server on http://127.0.0.1:${port}/`);
const child = spawn("npx", ["vite", "--port", String(port)], {
  stdio: "inherit",
  env: { ...process.env, WS_PORT: String(port) },
});
child.on("exit", (code) => process.exit(code ?? 0));
