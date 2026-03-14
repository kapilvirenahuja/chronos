import fs from "node:fs";
import YAML from "yaml";
import { z } from "zod";

import { resolveFromRoot } from "@/lib/utils";

const channelsSchema = z.object({
  channel: z.object({
    messaging: z.object({
      provider: z.literal("discord"),
      discord: z.object({
        server_id: z.string(),
        channel_id: z.string(),
        dm_enabled: z.boolean()
      })
    }),
    web: z.object({
      enabled: z.boolean(),
      base_url: z.string(),
      page_ttl_hours: z.number(),
      auth: z.string()
    })
  })
});

const engineSchema = z.object({
  engine: z.object({
    model: z.string(),
    model_for_eval_agent: z.string(),
    token_budget: z.object({
      system_layer: z.number(),
      recipe_layer: z.number(),
      stm: z.number(),
      history: z.number(),
      signal: z.number()
    }),
    token_tracking: z.boolean(),
    max_intents_per_query: z.number(),
    max_parallel_agents: z.number(),
    max_replans: z.number(),
    response_channel: z.object({
      inline_word_limit: z.number(),
      clarification_inline_word_limit: z.number()
    })
  }),
  decision_log: z.object({
    retention_days: z.number(),
    log_all_classifications: z.boolean(),
    log_all_ltm_writes: z.boolean()
  })
});

const confidenceSchema = z.object({
  confidence: z.object({
    intent_detection: z.object({
      auto_threshold: z.number(),
      ask_threshold: z.number()
    }),
    classification: z.object({
      auto_threshold: z.number(),
      ask_threshold: z.number()
    }),
    ltm_write: z.object({
      auto_threshold: z.number(),
      ask_threshold: z.number()
    })
  })
});

const memorySchema = z.object({
  memory: z.object({
    layer1: z.object({
      type: z.string(),
      connection: z.string()
    }),
    layer2: z.object({
      provider: z.string(),
      connection: z.string()
    }),
    adapter_path: z.string(),
    recalibrate_on_change: z.boolean(),
    stm: z.object({
      token_budget: z.number()
    }),
    history: z.object({
      token_budget: z.number()
    })
  })
});

const trustSchema = z.object({
  trust: z.object({
    owner_ids: z.array(z.string()),
    trusted_ids: z.array(z.string()),
    trusted_recipes: z.array(z.string()),
    guest_recipes: z.array(z.string()),
    unknown_action: z.string()
  })
});

const heartbeatSchema = z.object({
  heartbeat: z.object({
    interval: z.string(),
    quiet_hours: z.object({
      start: z.string(),
      end: z.string(),
      timezone: z.string()
    }),
    notification: z.object({
      delivery_time: z.string(),
      enabled_types: z.string(),
      max_words: z.number()
    }),
    batch_size: z.number()
  })
});

const sessionSchema = z.object({
  session: z.object({
    max_active_sessions: z.number(),
    clear_commands: z.array(z.string()),
    new_commands: z.array(z.string()),
    load_commands: z.array(z.string()),
    persist_indefinitely: z.boolean(),
    hooks: z.object({
      on_session_start: z.array(z.string()),
      on_message_received: z.array(z.string()),
      post_response: z.array(z.string()),
      on_session_clear: z.array(z.string()),
      post_session_archive: z.array(z.string())
    })
  })
});

export type ChronosConfig = {
  channels: z.infer<typeof channelsSchema>;
  engine: z.infer<typeof engineSchema>;
  confidence: z.infer<typeof confidenceSchema>;
  memory: z.infer<typeof memorySchema>;
  trust: z.infer<typeof trustSchema>;
  heartbeat: z.infer<typeof heartbeatSchema>;
  session: z.infer<typeof sessionSchema>;
};

let configCache: ChronosConfig | null = null;

const DEV_ANTHROPIC_MODEL = "claude-3-haiku-20240307";
const PROD_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const PROD_ANTHROPIC_EVAL_MODEL = "claude-haiku-4-5-20251001";

export type ChronosRuntimeStage = "development" | "production";

export function getChronosRuntimeStage(): ChronosRuntimeStage {
  if (process.env.CHRONOS_RUNTIME_MODE === "production") {
    return "production";
  }

  if (process.env.CHRONOS_RUNTIME_MODE === "development") {
    return "development";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "development"
  ) {
    return "development";
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function resolveAnthropicModels(): {
  stage: ChronosRuntimeStage;
  primary: string;
  eval: string;
} {
  const stage = getChronosRuntimeStage();

  return {
    stage,
    primary:
      process.env.ANTHROPIC_MODEL ??
      (stage === "production" ? PROD_ANTHROPIC_MODEL : DEV_ANTHROPIC_MODEL),
    eval:
      process.env.ANTHROPIC_MODEL_FOR_EVAL_AGENT ??
      (stage === "production" ? PROD_ANTHROPIC_EVAL_MODEL : DEV_ANTHROPIC_MODEL)
  };
}

function loadYamlFile<T>(relativePath: string, schema: z.ZodSchema<T>): T {
  const filePath = resolveFromRoot(relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return schema.parse(YAML.parse(raw));
}

export function loadConfig(): ChronosConfig {
  if (configCache) {
    return configCache;
  }

  const channels = loadYamlFile("config/channels.yaml", channelsSchema);
  const engine = loadYamlFile("config/engine.yaml", engineSchema);
  const confidence = loadYamlFile("config/confidence.yaml", confidenceSchema);
  const memory = loadYamlFile("config/memory.yaml", memorySchema);
  const trust = loadYamlFile("config/trust.yaml", trustSchema);
  const heartbeat = loadYamlFile("config/heartbeat.yaml", heartbeatSchema);
  const session = loadYamlFile("config/session.yaml", sessionSchema);
  const anthropicModels = resolveAnthropicModels();

  const ownerIds = process.env.CHRONOS_OWNER_IDS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (ownerIds && ownerIds.length > 0) {
    trust.trust.owner_ids = ownerIds;
  }

  if (process.env.CHRONOS_BASE_URL) {
    channels.channel.web.base_url = process.env.CHRONOS_BASE_URL;
  } else if (process.env.VERCEL_URL) {
    channels.channel.web.base_url = `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.CHRONOS_LTM_PATH) {
    memory.memory.layer1.connection = process.env.CHRONOS_LTM_PATH;
    memory.memory.layer2.connection = process.env.CHRONOS_LTM_PATH;
  }

  engine.engine.model = anthropicModels.primary;
  engine.engine.model_for_eval_agent = anthropicModels.eval;

  if (
    process.env.CHRONOS_STORE === "blob" ||
    Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  ) {
    memory.memory.layer1.type = "blob";
    memory.memory.layer1.connection = "vercel-blob";
    memory.memory.layer2.provider = "blob";
    memory.memory.layer2.connection = "vercel-blob";
  }

  if (process.env.ELASTIC_URL) {
    memory.memory.layer2.provider = "elastic";
    memory.memory.layer2.connection = process.env.ELASTIC_URL;
  } else if (process.env.UPSTASH_VECTOR_REST_URL) {
    memory.memory.layer2.provider = "upstash_vector";
    memory.memory.layer2.connection = process.env.UPSTASH_VECTOR_REST_URL;
  }

  configCache = {
    channels,
    engine,
    confidence,
    memory,
    trust,
    heartbeat,
    session
  };

  return configCache;
}

export function resetConfigForTests(): void {
  configCache = null;
}
