import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type StatusTone = 'idle' | 'success' | 'error' | 'loading';
type Step = 'token' | 'servers' | 'dashboard';

type AuthSession = {
  token: string;
  header: string;
  isBot: boolean;
};

type GuildSummary = {
  id: string;
  name: string;
  icon: string | null;
};

type GuildDetails = GuildSummary;

type EmojiItem = {
  id: string;
  name: string;
  animated: boolean;
};

type SelectedServer = {
  id: string;
  name: string;
  icon: string | null;
};

type AppMessage = {
  tone: StatusTone;
  message: string;
};

const API_BASE = 'https://discord.com/api/v10';

const DEFAULT_MESSAGE: AppMessage = {
  tone: 'idle',
  message: '',
};

const normalizeToken = (raw: string) => raw.trim().replace(/^Bot\s+/i, '');

const sanitizeRawToken = (raw: string): { token: string; removedQuotes: boolean } => {
  let s = raw.trim();
  let removedQuotes = false;

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
    removedQuotes = true;
  }

  const token = s.replace(/^Bot\s+/i, '').trim();
  return { token, removedQuotes };
};

const isBotTokenInput = (raw: string) => /^Bot\s+/i.test(raw.trim());

const sanitizeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') || 'download';

const guildIconUrl = (guild: GuildSummary) => {
  if (!guild.icon) return null;

  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`;
};

const emojiImageUrl = (emoji: EmojiItem) => {
  const ext = emoji.animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
};

const emojiDownloadUrl = (emoji: EmojiItem) => {
  const ext = emoji.animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
};

async function fetchDiscordJson<T>(path: string, authHeader: string): Promise<T> {
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

const formatError = (error: unknown, fallback = 'Something went wrong.') => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};

function App() {
  const [step, setStep] = useState<Step>('token');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenType, setTokenType] = useState<'user' | 'bot'>('user');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenNote, setTokenNote] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildSearch, setGuildSearch] = useState('');
  const [guildLoading, setGuildLoading] = useState(false);
  const [guildError, setGuildError] = useState<string | null>(null);
  const [manualServerId, setManualServerId] = useState('');
  const [multiServerMode, setMultiServerMode] = useState(false);
  const [selectedServers, setSelectedServers] = useState<SelectedServer[]>([]);

  const [selectedServer, setSelectedServer] = useState<SelectedServer | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [serverEmojisMap, setServerEmojisMap] = useState<{ [serverId: string]: EmojiItem[] }>({});
  const [serverLoadingMap, setServerLoadingMap] = useState<{ [serverId: string]: boolean }>({});
  const [emojis, setEmojis] = useState<EmojiItem[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [selectedEmojiIds, setSelectedEmojiIds] = useState<Set<string>>(new Set());

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<AppMessage>(DEFAULT_MESSAGE);

  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const guildSearchRef = useRef<HTMLInputElement | null>(null);
  const emojiSearchRef = useRef<HTMLInputElement | null>(null);
  const guildRequestIdRef = useRef(0);
  const dashboardRequestIdRef = useRef(0);
  const lastServerRequestRef = useRef<SelectedServer | null>(null);

  const selectedEmojiList = useMemo(
    () => emojis.filter((emoji) => selectedEmojiIds.has(emoji.id)),
    [emojis, selectedEmojiIds],
  );

  const filteredGuilds = useMemo(() => {
    const query = guildSearch.trim().toLowerCase();
    if (!query) return guilds;
    return guilds.filter((guild) => guild.name.toLowerCase().includes(query));
  }, [guildSearch, guilds]);

  const filteredEmojis = useMemo(() => {
    const query = emojiSearch.trim().toLowerCase();
    if (!query) return emojis;
    return emojis.filter((emoji) => emoji.name.toLowerCase().includes(query));
  }, [emojiSearch, emojis]);

  const allVisibleSelected = useMemo(
    () => filteredEmojis.length > 0 && filteredEmojis.every((emoji) => selectedEmojiIds.has(emoji.id)),
    [filteredEmojis, selectedEmojiIds],
  );

  const selectedCount = selectedEmojiIds.size;

  const loadGuilds = useCallback(async (session: AuthSession) => {
    const requestId = ++guildRequestIdRef.current;
    setGuildLoading(true);
    setGuildError(null);

    try {
      const list = await fetchDiscordJson<GuildSummary[]>('/users/@me/guilds', session.header);
      if (requestId !== guildRequestIdRef.current) return;

      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      setGuilds(sorted);

      if (session.isBot) {
        setGuildError('Server list may be unavailable for bot tokens. Use Server ID below if needed.');
      }
    } catch (error) {
      if (requestId !== guildRequestIdRef.current) return;

      setGuildError(
        session.isBot
          ? 'Server list unavailable for this token. Use Server ID below.'
          : formatError(error, 'Failed to load servers.'),
      );
      setGuilds([]);
    } finally {
      if (requestId === guildRequestIdRef.current) {
        setGuildLoading(false);
      }
    }
  }, []);

  const loadServer = useCallback(
    async (server: SelectedServer) => {
      if (!authSession) return;

      const requestId = ++dashboardRequestIdRef.current;
      lastServerRequestRef.current = server;

      setStep('dashboard');
      setSelectedServer(server);
      setEmojis([]);
      setSelectedEmojiIds(new Set());
      setEmojiSearch('');
      setDashboardLoading(true);
      setDashboardError(null);
      setExportMessage(DEFAULT_MESSAGE);

      try {
        const [guildResult, emojiResult] = await Promise.allSettled([
          fetchDiscordJson<GuildDetails>(`/guilds/${server.id}`, authSession.header),
          fetchDiscordJson<EmojiItem[]>(`/guilds/${server.id}/emojis`, authSession.header),
        ]);

        if (requestId !== dashboardRequestIdRef.current) return;

        if (emojiResult.status === 'rejected') {
          throw emojiResult.reason;
        }

        const guildDetails = guildResult.status === 'fulfilled' ? guildResult.value : null;

        setSelectedServer({
          id: guildDetails?.id ?? server.id,
          name: guildDetails?.name ?? server.name,
          icon: guildDetails?.icon ?? server.icon,
        });
        setEmojis(emojiResult.value);
      } catch (error) {
        if (requestId !== dashboardRequestIdRef.current) return;

        setDashboardError(`Failed to load emojis. ${formatError(error)}`);
        setEmojis([]);
      } finally {
        if (requestId === dashboardRequestIdRef.current) {
          setDashboardLoading(false);
        }
      }
    },
    [authSession],
  );

  const loadMultipleServers = useCallback(async () => {
    if (!authSession) return;

    const requestId = ++dashboardRequestIdRef.current;
    setDashboardLoading(true);
    setDashboardError(null);
    setExportMessage(DEFAULT_MESSAGE);
    setEmojis([]);
    setSelectedEmojiIds(new Set());
    setEmojiSearch('');

    try {
      const allEmojis: EmojiItem[] = [];
      const errors: string[] = [];

      for (const server of selectedServers) {
        try {
          const emojiResult = await fetchDiscordJson<EmojiItem[]>(`/guilds/${server.id}/emojis`, authSession.header);
          allEmojis.push(...emojiResult);
        } catch (error) {
          errors.push(`Failed to load emojis from ${server.name}`);
        }
      }

      if (requestId !== dashboardRequestIdRef.current) return;

      setEmojis(allEmojis);
      if (errors.length > 0) {
        setDashboardError(errors.join('; '));
      }
    } catch (error) {
      if (requestId !== dashboardRequestIdRef.current) return;
      setDashboardError(formatError(error, 'Failed to load emojis.'));
      setEmojis([]);
    } finally {
      if (requestId === dashboardRequestIdRef.current) {
        setDashboardLoading(false);
      }
    }
  }, [authSession, selectedServers]);

  useEffect(() => {
    if (step === 'token') {
      tokenInputRef.current?.focus();
    }

    if (step === 'servers') {
      guildSearchRef.current?.focus();
    }

    if (step === 'dashboard') {
      emojiSearchRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (exportMessage.message) {
        setExportMessage(DEFAULT_MESSAGE);
      }
    }, 4500);

    if (!exportMessage.message) {
      window.clearTimeout(timer);
    }

    return () => window.clearTimeout(timer);
  }, [exportMessage.message]);

  const handleConnect = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const rawToken = tokenInput.trim();
      if (!rawToken) {
        setTokenError('Token is required.');
        return;
      }

      const isBot = tokenType === 'bot';

      const { token, removedQuotes } = sanitizeRawToken(rawToken);

      if (removedQuotes) {
        setTokenNote('Removed surrounding quotes from token');
        setTokenInput(token);
        window.setTimeout(() => setTokenNote(null), 4500);
      }

      if (!token) {
        setTokenError('Token is required.');
        return;
      }

      const header = isBot ? `Bot ${token}` : token;

      setConnectLoading(true);
      setTokenError(null);

      try {
        if (isBot) {
          await fetchDiscordJson('/oauth2/applications/@me', header);
        } else {
          await fetchDiscordJson('/users/@me', header);
        }

        const session: AuthSession = { token, header, isBot };
        setAuthSession(session);
        setStep('servers');
        setGuilds([]);
        setGuildSearch('');
        setGuildError(null);
        setManualServerId('');
        setSelectedServer(null);
        setEmojis([]);
        setSelectedEmojiIds(new Set());
        setEmojiSearch('');
        setDashboardError(null);
        setExportMessage(DEFAULT_MESSAGE);

        void loadGuilds(session);
      } catch (error) {
        const message = formatError(error, 'Invalid token.');
        setTokenError(message.toLowerCase().includes('invalid') ? message : 'Invalid token.');
        tokenInputRef.current?.focus();
      } finally {
        setConnectLoading(false);
      }
    },
    [loadGuilds, tokenInput],
  );

  const handleRetryGuilds = useCallback(() => {
    if (!authSession) return;
    void loadGuilds(authSession);
  }, [authSession, loadGuilds]);

  const handleGuildSelect = useCallback(
    (guild: GuildSummary) => {
      if (multiServerMode) {
        setSelectedServers((prev) => {
          const exists = prev.some((s) => s.id === guild.id);
          if (exists) {
            return prev.filter((s) => s.id !== guild.id);
          } else {
            return [...prev, { id: guild.id, name: guild.name, icon: guild.icon }];
          }
        });
      } else {
        void loadServer({ id: guild.id, name: guild.name, icon: guild.icon });
      }
    },
    [loadServer, multiServerMode],
  );

  const handleManualServerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const serverId = manualServerId.trim();

      if (!serverId) {
        setGuildError('Server ID is required.');
        return;
      }

      void loadServer({ id: serverId, name: serverId, icon: null });
    },
    [loadServer, manualServerId],
  );

  const handleToggleEmoji = useCallback((emojiId: string) => {
    setSelectedEmojiIds((current) => {
      const next = new Set(current);
      if (next.has(emojiId)) {
        next.delete(emojiId);
      } else {
        next.add(emojiId);
      }
      return next;
    });
  }, []);

  const handleToggleVisible = useCallback(() => {
    const visibleIds = filteredEmojis.map((emoji) => emoji.id);

    setSelectedEmojiIds((current) => {
      const next = new Set(current);
      const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));

      if (isAllVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }, [filteredEmojis]);

  const handleExport = useCallback(async () => {
    if (!selectedServer || selectedEmojiList.length === 0) return;

    setExporting(true);
    setExportMessage({ tone: 'loading', message: 'Exporting selected emojis…' });

    try {
      const zip = new JSZip();
      const failedNames: string[] = [];
      const serverFolderName = sanitizeFileName(selectedServer.name);

      for (const emoji of selectedEmojiList) {
        const fileName = `${sanitizeFileName(emoji.name)}.${emoji.animated ? 'gif' : 'png'}`;
        const url = emojiDownloadUrl(emoji);

        try {
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const blob = await response.blob();
          zip.file(fileName, blob);
        } catch (error) {
          failedNames.push(emoji.name);
          console.warn(`Failed to download emoji: ${emoji.name}`, error);
        }
      }

      if (Object.keys(zip.files).length === 0) {
        throw new Error('No emojis could be downloaded.');
      }

      const archiveBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(archiveBlob, `${serverFolderName}-emojis.zip`);

      setExportMessage({
        tone: failedNames.length > 0 ? 'success' : 'success',
        message:
          failedNames.length > 0
            ? `Export complete. ${failedNames.length} emojis failed to download.`
            : `Export complete. ${selectedEmojiList.length} emojis downloaded.`,
      });
    } catch (error) {
      setExportMessage({
        tone: 'error',
        message: formatError(error, 'Export failed.'),
      });
    } finally {
      setExporting(false);
    }
  }, [selectedEmojiList, selectedServer]);

  const handleRetryDashboard = useCallback(() => {
    if (!lastServerRequestRef.current) return;
    void loadServer(lastServerRequestRef.current);
  }, [loadServer]);

  const handleOpenMultiServerDashboard = useCallback(() => {
    if (!authSession || selectedServers.length === 0) return;
    setStep('dashboard');
    setSelectedServer(null);
    void loadMultipleServers();
  }, [authSession, selectedServers.length, loadMultipleServers]);

  const handleBackToServers = useCallback(() => {
    setStep('servers');
    setDashboardError(null);
    setExportMessage(DEFAULT_MESSAGE);
  }, []);

  const selectedServerIcon = selectedServer?.icon ? guildIconUrl(selectedServer) : null;
  const visibleCount = filteredEmojis.length;

  return (
    <main className="app-shell">
      {step === 'token' ? (
        <section className="auth-screen" aria-label="Discord token login">
          <form className="auth-card panel" onSubmit={handleConnect}>
            <h1 className="app-title">Discord Emoji Exporter</h1>

            <label className="field-label" htmlFor="token-input">
              Discord token
            </label>

            <div className="token-tabs">
              <button
                type="button"
                className={`token-tab ${tokenType === 'user' ? 'active' : ''}`}
                onClick={() => setTokenType('user')}
              >
                User
              </button>
              <button
                type="button"
                className={`token-tab ${tokenType === 'bot' ? 'active' : ''}`}
                onClick={() => setTokenType('bot')}
              >
                Bot
              </button>
            </div>

            <div className="token-input-wrapper">
              <input
                ref={tokenInputRef}
                id="token-input"
                className="token-input"
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(event) => {
                  setTokenInput(event.target.value);
                  setTokenError(null);
                }}
                placeholder="Paste a Discord token"
                autoComplete="off"
                spellCheck={false}
              />
              <label className="show-token-label">
                <input
                  type="checkbox"
                  checked={showToken}
                  onChange={() => setShowToken((s) => !s)}
                />
                Show
              </label>
            </div>

            {tokenNote ? <p className="note" aria-live="polite">{tokenNote}</p> : null}

            <div className="token-instructions">
              <div className="instruction-block">
                <strong>User token (desktop Discord)</strong>
                <ol>
                  <li>Open Discord in a desktop browser.</li>
                  <li>Open Developer Tools (Cmd+Option+I / Ctrl+Shift+I).</li>
                  <li>Go to Application → Local Storage → https://discord.com and find the <code>token</code> key.</li>
                  <li>Copy the value (remove surrounding quotes) and paste here.</li>
                </ol>
                <p className="note">You can also run <code>copy(localStorage.getItem('token'))</code> in Console.</p>
              </div>
              {tokenType === 'bot' ? (
                <div className="instruction-block">
                  <strong>Bot token (Developer Portal)</strong>
                  <ol>
                    <li>Open <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a>.</li>
                    <li>Select your application, open the "Bot" section, and create a bot if needed.</li>
                    <li>Click "Reset Token" or "Copy" to reveal and copy the bot token.</li>
                    <li>Paste the token here. The app will prefix <em>Bot </em> automatically if needed.</li>
                  </ol>
                </div>
              ) : null}
            </div>

            {tokenError ? (
              <p className="inline-error" role="alert">
                {tokenError}
              </p>
            ) : null}

            <button type="submit" className="primary connect-button" disabled={connectLoading}>
              {connectLoading ? 'Connecting…' : 'Connect'}
            </button>
          </form>
        </section>
      ) : null}

      {step === 'servers' ? (
        <section className="servers-screen" aria-label="Server selection">
          <div className="panel servers-card">
            <div className="section-header compact-header">
              <div>
                <p className="section-label">Servers</p>
                <h2>Select a server</h2>
              </div>
              <button type="button" className="secondary compact-action" onClick={() => setStep('token')}>
                Change token
              </button>
            </div>

            <input
              ref={guildSearchRef}
              className="search-input"
              type="search"
              value={guildSearch}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setGuildSearch(event.target.value)}
              placeholder="Search servers"
            />

            {guildLoading ? <p className="section-status">Loading servers…</p> : null}
            {guildError ? (
              <div className="error-box" role="alert">
                <p>{guildError}</p>
                <button type="button" className="secondary" onClick={handleRetryGuilds}>
                  Retry
                </button>
              </div>
            ) : null}

            <div style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}>
              <label className="field-label" style={{ marginBottom: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={multiServerMode}
                  onChange={() => setMultiServerMode(!multiServerMode)}
                  style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                />
                Select multiple servers
              </label>
            </div>

            <div className="guild-list" role="list" aria-label="Available servers">
              {filteredGuilds.length > 0 ? (
                filteredGuilds.map((guild) => {
                  const icon = guildIconUrl(guild);
                  const isSelected = selectedServers.some((s) => s.id === guild.id);
                  return (
                    <button
                      key={guild.id}
                      type="button"
                      className={`guild-item ${multiServerMode && isSelected ? 'selected' : ''}`}
                      onClick={() => handleGuildSelect(guild)}
                    >
                      {multiServerMode ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                        />
                      ) : null}
                      {icon ? (
                        <img className="guild-icon" src={icon} alt="" />
                      ) : (
                        <span className="guild-icon guild-fallback">{guild.name.charAt(0).toUpperCase()}</span>
                      )}
                      <span className="guild-name">{guild.name}</span>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state compact-empty">No servers found</div>
              )}
            </div>

            {multiServerMode && selectedServers.length > 0 ? (
              <button
                type="button"
                className="primary"
                style={{ width: '100%', marginTop: '0.75rem' }}
                onClick={() => void handleOpenMultiServerDashboard()}
              >
                View {selectedServers.length} Server{selectedServers.length === 1 ? '' : 's'}
              </button>
            ) : null}

            <form className="manual-form" onSubmit={handleManualServerSubmit}>
              <label className="field-label" htmlFor="server-id-input">
                Server ID
              </label>
              <div className="manual-row">
                <input
                  id="server-id-input"
                  className="search-input"
                  type="text"
                  value={manualServerId}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setManualServerId(event.target.value)}
                  placeholder="Paste server ID"
                />
                <button type="submit" className="primary manual-button">
                  Use ID
                </button>
              </div>
            </form>
            <div className="server-id-instructions">
              <p className="note" style={{marginTop: '0.6rem'}}>
                To copy a Server ID: enable <strong>Developer Mode</strong> in Discord Settings → Advanced, then
                right‑click a server icon (desktop) and choose "Copy ID". Paste it above.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {step === 'dashboard' ? (
        <section className="dashboard-screen" aria-label="Emoji dashboard">
          <div className="panel dashboard-shell">
            <header className="dashboard-topbar">
              <div className="server-meta">
                {!multiServerMode && selectedServerIcon ? (
                  <img className="server-icon" src={selectedServerIcon} alt="" />
                ) : null}
                {multiServerMode ? (
                  <div>
                    <p style={{ margin: '0 0 0.3rem', color: 'rgba(237, 242, 255, 0.66)', fontSize: '0.84rem' }}>
                      {selectedServers.length} Servers
                    </p>
                    <h2>
                      {selectedServers.map((s) => s.name).join(', ')}
                    </h2>
                  </div>
                ) : (
                  <>
                    {selectedServerIcon ? null : (
                      <span className="server-icon server-fallback">{selectedServer?.name?.charAt(0).toUpperCase() ?? '?'}</span>
                    )}
                    <div>
                      <h2>{selectedServer?.name ?? 'Server'}</h2>
                      <p>{emojis.length} emojis</p>
                    </div>
                  </>
                )}
              </div>

              <div className="dashboard-controls">
                <input
                  ref={emojiSearchRef}
                  className="search-input compact-search"
                  type="search"
                  value={emojiSearch}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEmojiSearch(event.target.value)}
                  placeholder="Filter emojis"
                />
                <button type="button" className="secondary" onClick={handleToggleVisible} disabled={visibleCount === 0}>
                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button type="button" className="secondary" onClick={handleBackToServers}>
                  {multiServerMode ? 'Back' : 'Change server'}
                </button>
              </div>
            </header>

            {dashboardLoading ? <p className="section-status">Loading emojis…</p> : null}

            {dashboardError ? (
              <div className="error-box dashboard-error" role="alert">
                <p>{dashboardError}</p>
                <button type="button" className="secondary" onClick={handleRetryDashboard}>
                  Retry
                </button>
              </div>
            ) : null}

            {!dashboardLoading && !dashboardError ? (
              <div className="emoji-grid">
                {filteredEmojis.map((emoji) => {
                  const selected = selectedEmojiIds.has(emoji.id);

                  return (
                    <button
                      key={emoji.id}
                      type="button"
                      className={`emoji-card ${selected ? 'selected' : ''}`}
                      onClick={() => handleToggleEmoji(emoji.id)}
                      aria-pressed={selected}
                    >
                      <div className="emoji-frame">
                        <img className="emoji-image" src={emojiImageUrl(emoji)} alt={emoji.name} loading="lazy" />
                        {selected ? <span className="emoji-check">✓</span> : null}
                      </div>
                      <span className="emoji-name">{emoji.name}</span>
                    </button>
                  );
                })}

                {filteredEmojis.length === 0 ? <div className="empty-state emoji-empty">No emojis found</div> : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {exportMessage.message ? (
        <div className={`export-toast ${exportMessage.tone}`} role="status" aria-live="polite">
          {exportMessage.message}
        </div>
      ) : null}

      {step === 'dashboard' ? (
        <button
          type="button"
          className="export-fab"
          onClick={() => void handleExport()}
          disabled={selectedCount === 0 || exporting || dashboardLoading || Boolean(dashboardError)}
        >
          {exporting ? 'Exporting…' : `Export ${selectedCount} Emojis`}
        </button>
      ) : null}
    </main>
  );
}

export default App;