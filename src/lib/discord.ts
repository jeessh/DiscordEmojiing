export type StatusTone = 'idle' | 'success' | 'error' | 'loading';

export type AuthSession = {
  token: string;
  header: string;
  isBot: boolean;
};

export type GuildSummary = {
  id: string;
  name: string;
  icon: string | null;
};

export type GuildDetails = GuildSummary;

export type EmojiItem = {
  id: string;
  name: string;
  animated: boolean;
};

export type SelectedServer = {
  id: string;
  name: string;
  icon: string | null;
};

export type AppMessage = {
  tone: StatusTone;
  message: string;
};

export const API_BASE = 'https://discord.com/api/v10';

export const DEFAULT_MESSAGE: AppMessage = {
  tone: 'idle',
  message: '',
};

export const sanitizeRawToken = (raw: string): { token: string; removedQuotes: boolean } => {
  let value = raw.trim();
  let removedQuotes = false;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
    removedQuotes = true;
  }

  const token = value.replace(/^Bot\s+/i, '').trim();
  return { token, removedQuotes };
};

export const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') || 'download';

export const guildIconUrl = (guild: GuildSummary) => {
  if (!guild.icon) return null;

  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`;
};

export const emojiImageUrl = (emoji: EmojiItem) => {
  const ext = emoji.animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
};

export const emojiDownloadUrl = (emoji: EmojiItem) => {
  const ext = emoji.animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
};

export async function fetchDiscordJson<T>(path: string, authHeader: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(responseText || `Discord API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const formatError = (error: unknown, fallback = 'Something went wrong.') => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};
