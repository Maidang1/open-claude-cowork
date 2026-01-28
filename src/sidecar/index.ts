import { initDB } from "../main/db/store";
import { registerAllHandlers } from "./handlers";
import { JsonRpcServer } from "./server";

const main = async () => {
  initDB();

  const server = new JsonRpcServer();
  registerAllHandlers(server);

  const port = await server.listen(0);
  console.log(`SIDECAR_PORT:${port}`);
  console.error(`[Sidecar] Server started on port ${port}`);

  process.on("SIGTERM", () => {
    console.error("[Sidecar] Received SIGTERM, shutting down...");
    server.close();
    process.exit(0);
  });
};

main().catch((err) => {
  console.error("[Sidecar] Fatal error:", err);
  process.exit(1);
});
