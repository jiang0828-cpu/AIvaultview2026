import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
async function availablePort(start) {
  for (let port = start; port < start + 100; port++) {
    const free = await new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen({ port, host: "0.0.0.0", exclusive: true }, () =>
        server.close(() => resolve(true)),
      );
    });
    if (free) return port;
  }
  throw new Error("No available local port found.");
}
if (!existsSync(".env")) {
  const apiPort = await availablePort(3001);
  const webPort = await availablePort(5173);
  const content = readFileSync(".env.example", "utf8")
    .replace(
      "replace-with-at-least-32-random-characters",
      randomBytes(48).toString("hex"),
    )
    .replace(
      "replace-with-a-different-admin-password",
      randomBytes(16).toString("base64url"),
    )
    .replace("PORT=3001", `PORT=${apiPort}`)
    .replace("http://localhost:5173", `http://localhost:${webPort}`);
  writeFileSync(".env", content, { mode: 0o600 });
  console.log(
    "Created .env with unique local credentials. Read this file locally to sign in.",
  );
  console.log(
    `Web: http://localhost:${webPort}; API: http://localhost:${apiPort}`,
  );
} else console.log("Keeping existing .env.");
