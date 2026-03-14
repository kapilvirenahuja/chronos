const mode = process.argv[2];

if (!["guild", "global"].includes(mode)) {
  console.error("Usage: node scripts/register-discord-commands.mjs <guild|global>");
  process.exit(1);
}

const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!applicationId) {
  console.error("Missing DISCORD_APPLICATION_ID");
  process.exit(1);
}

if (!botToken) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

if (mode === "guild" && !guildId) {
  console.error("Missing DISCORD_GUILD_ID for guild registration");
  process.exit(1);
}

const commands = [
  {
    name: "capture",
    description: "Capture a raw thought into Chronos",
    options: [
      {
        type: 3,
        name: "text",
        description: "The thought to capture",
        required: true
      }
    ]
  },
  {
    name: "new",
    description: "Start a new Chronos session",
    options: [
      {
        type: 3,
        name: "topic",
        description: "Session topic",
        required: false
      }
    ]
  },
  {
    name: "load",
    description: "Load an existing session",
    options: [
      {
        type: 3,
        name: "session_id",
        description: "Session id to load",
        required: true
      }
    ]
  },
  {
    name: "clear",
    description: "Archive a session",
    options: [
      {
        type: 3,
        name: "session_id",
        description: "Session id to archive",
        required: false
      }
    ]
  },
  {
    name: "sessions",
    description: "List recent sessions"
  },
  {
    name: "heartbeat",
    description: "Run heartbeat classification now"
  },
  {
    name: "ask",
    description: "Reserved for the future ask flow",
    options: [
      {
        type: 3,
        name: "question",
        description: "Question for Chronos",
        required: true
      }
    ]
  }
];

const baseUrl =
  mode === "guild"
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const headers = {
  Authorization: `Bot ${botToken}`,
  "Content-Type": "application/json"
};

for (const command of commands) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to register ${command.name}: ${response.status} ${body}`);
    process.exit(1);
  }

  const registered = await response.json();
  console.log(`Registered ${registered.name} (${registered.id})`);
}
