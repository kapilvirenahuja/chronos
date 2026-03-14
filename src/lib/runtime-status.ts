import { getChronosRuntimeStage, loadConfig } from "@/lib/config";

export interface IntegrationStatus {
  server: "ready";
  store: "file" | "postgres" | "blob";
  memory_adapter: string;
  execution: {
    mode: "inline" | "queued";
  };
  anthropic: {
    configured: boolean;
    mode: "heuristic-only" | "api-ready";
    runtime_stage: "development" | "production";
    model: string;
    eval_model: string;
  };
  discord: {
    route_ready: boolean;
    signature_verification_configured: boolean;
    application_id_configured: boolean;
    bot_token_configured: boolean;
  };
  postgres: {
    configured: boolean;
    auto_migrate: boolean;
  };
  search: {
    provider: string;
    configured: boolean;
  };
}

export function getRuntimeStatus(): IntegrationStatus {
  const config = loadConfig();
  const runtimeStage = getChronosRuntimeStage();
  const store =
    process.env.CHRONOS_STORE === "postgres" || process.env.POSTGRES_URL
      ? "postgres"
      : process.env.CHRONOS_STORE === "blob" || process.env.BLOB_READ_WRITE_TOKEN
        ? "blob"
      : "file";

  return {
    server: "ready",
    store,
    memory_adapter: config.memory.memory.layer1.type,
    execution: {
      mode:
        (process.env.CHRONOS_SIGNAL_EXECUTION_MODE ?? "inline") === "queued"
          ? "queued"
          : "inline"
    },
    anthropic: {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      mode: process.env.ANTHROPIC_API_KEY ? "api-ready" : "heuristic-only",
      runtime_stage: runtimeStage,
      model: config.engine.engine.model,
      eval_model: config.engine.engine.model_for_eval_agent
    },
    discord: {
      route_ready: true,
      signature_verification_configured: Boolean(process.env.DISCORD_PUBLIC_KEY),
      application_id_configured: Boolean(process.env.DISCORD_APPLICATION_ID),
      bot_token_configured: Boolean(process.env.DISCORD_BOT_TOKEN)
    },
    postgres: {
      configured: Boolean(process.env.POSTGRES_URL),
      auto_migrate: process.env.CHRONOS_AUTO_MIGRATE === "true"
    },
    search: {
      provider: config.memory.memory.layer2.provider,
      configured: Boolean(
        config.memory.memory.layer2.provider === "local_index" ||
        process.env.ELASTIC_URL ||
          (process.env.UPSTASH_VECTOR_REST_URL &&
            process.env.UPSTASH_VECTOR_REST_TOKEN)
      )
    }
  };
}
