export const SLACK_API_BASE = 'https://slack.com/api';

export type SlackWorkspace = {
  name: string;
  domain: string;
};

export type SlackEmojiItem = {
  name: string;
  url: string;
};

type SlackApiEnvelope = {
  ok: boolean;
  error?: string;
};

type SlackAuthTestResponse = SlackApiEnvelope & {
  team?: string;
  url?: string;
};

type SlackEmojiListResponse = SlackApiEnvelope & {
  emoji?: Record<string, string>;
};

type SlackEmojiAddResponse = SlackApiEnvelope;

export const sanitizeSlackToken = (raw: string) => {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
};

export const isSlackUserToken = (token: string) => token.startsWith('xoxp-');

const extractWorkspaceDomain = (url?: string) => {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('.slack.com', '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('.')[0] ?? '';
  }
};

const toReadableSlackError = (errorCode: string) => {
  const normalized = errorCode.replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

async function parseSlackResponse<T extends SlackApiEnvelope>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Slack API request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as T;

  if (!data.ok) {
    throw new Error(toReadableSlackError(data.error ?? 'unknown_error'));
  }

  return data;
}

export async function verifySlackWorkspace(token: string): Promise<SlackWorkspace> {
  const response = await fetch(`${SLACK_API_BASE}/auth.test`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseSlackResponse<SlackAuthTestResponse>(response);

  return {
    name: data.team ?? 'Workspace',
    domain: extractWorkspaceDomain(data.url),
  };
}

export async function fetchSlackEmojis(token: string): Promise<SlackEmojiItem[]> {
  const response = await fetch(`${SLACK_API_BASE}/emoji.list`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseSlackResponse<SlackEmojiListResponse>(response);

  return Object.entries(data.emoji ?? {})
    .filter(([, value]) => !value.startsWith('alias:'))
    .map(([name, url]) => ({ name, url }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function uploadSlackEmoji(token: string, name: string, image: Blob) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('mode', 'data');
  formData.append('image', image, `${name}.png`);

  const response = await fetch(`${SLACK_API_BASE}/emoji.add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    return { ok: false as const, error: `http_${response.status}` };
  }

  const data = (await response.json()) as SlackEmojiAddResponse;

  if (!data.ok) {
    return { ok: false as const, error: data.error ?? 'unknown_error' };
  }

  return { ok: true as const };
}

export const isSlackDuplicateError = (errorCode: string) => {
  const normalized = errorCode.toLowerCase();
  return normalized.includes('name_taken') || normalized.includes('already_exists') || normalized.includes('taken');
};

export const isSlackNotAdminError = (errorCode: string) => {
  const normalized = errorCode.toLowerCase();
  return normalized === 'not_admin' || normalized === 'missing_scope';
};

export const formatSlackError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const isLikelyNetworkError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('failed to fetch');
};
