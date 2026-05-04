import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  DEFAULT_MESSAGE,
  type AppMessage,
  type AuthSession,
  type EmojiItem,
  type GuildDetails,
  type GuildSummary,
  type SelectedServer,
  emojiDownloadUrl,
  fetchDiscordJson,
  formatError,
  sanitizeFileName,
  sanitizeRawToken,
  guildIconUrl,
} from '../lib/discord';

type AppState = {
  tokenInput: string;
  setTokenInput: (value: string) => void;
  tokenType: 'user' | 'bot';
  setTokenType: (value: 'user' | 'bot') => void;
  tokenError: string | null;
  clearTokenError: () => void;
  tokenNote: string | null;
  showToken: boolean;
  setShowToken: (value: boolean | ((current: boolean) => boolean)) => void;
  connectLoading: boolean;

  authSession: AuthSession | null;

  guilds: GuildSummary[];
  guildSearch: string;
  setGuildSearch: (value: string) => void;
  guildLoading: boolean;
  guildError: string | null;
  manualServerId: string;
  setManualServerId: (value: string) => void;
  multiServerMode: boolean;
  setMultiServerMode: (value: boolean) => void;
  selectedServers: SelectedServer[];

  selectedServer: SelectedServer | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  emojis: EmojiItem[];
  emojiSearch: string;
  setEmojiSearch: (value: string) => void;
  selectedEmojiIds: Set<string>;
  exporting: boolean;
  exportMessage: AppMessage;

  filteredGuilds: GuildSummary[];
  filteredEmojis: EmojiItem[];
  selectedEmojiList: EmojiItem[];
  allVisibleSelected: boolean;
  selectedCount: number;
  visibleCount: number;
  selectedServerIcon: string | null;

  goToToken: () => void;
  goToServers: () => void;
  goToDashboard: () => void;

  handleConnect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleRetryGuilds: () => void;
  handleGuildSelect: (guild: GuildSummary) => void;
  handleManualServerSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleToggleEmoji: (emojiId: string) => void;
  handleToggleVisible: () => void;
  handleExport: () => Promise<void>;
  handleRetryDashboard: () => void;
  handleOpenMultiServerDashboard: () => void;
  handleBackToServers: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
};

type AppStateProviderProps = {
  children: ReactNode;
  navigate: (path: string) => void;
};

export function AppStateProvider({ children, navigate }: AppStateProviderProps) {
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
  const [emojis, setEmojis] = useState<EmojiItem[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [selectedEmojiIds, setSelectedEmojiIds] = useState<Set<string>>(new Set());

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<AppMessage>(DEFAULT_MESSAGE);

  const tokenInputRef = useRef<HTMLInputElement | null>(null);
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
  const visibleCount = filteredEmojis.length;
  const selectedServerIcon = selectedServer?.icon ? guildIconUrl(selectedServer) : null;
  const clearTokenError = useCallback(() => setTokenError(null), []);

  const goToToken = useCallback(() => navigate('/token'), [navigate]);
  const goToServers = useCallback(() => navigate('/servers'), [navigate]);
  const goToDashboard = useCallback(() => navigate('/dashboard'), [navigate]);

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

  useEffect(() => {
    if (exportMessage.message) {
      const timer = window.setTimeout(() => setExportMessage(DEFAULT_MESSAGE), 4500);
      return () => window.clearTimeout(timer);
    }

    return undefined;
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
        setMultiServerMode(false);
        setSelectedServers([]);
        goToServers();
        void loadGuilds(session);
      } catch (error) {
        const message = formatError(error, 'Invalid token.');
        setTokenError(message.toLowerCase().includes('invalid') ? message : 'Invalid token.');
        tokenInputRef.current?.focus();
      } finally {
        setConnectLoading(false);
      }
    },
    [goToServers, loadGuilds, tokenInput, tokenType],
  );

  const loadServer = useCallback(
    async (server: SelectedServer) => {
      if (!authSession) return;

      const requestId = ++dashboardRequestIdRef.current;
      lastServerRequestRef.current = server;

      goToDashboard();
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
    [authSession, goToDashboard],
  );

  const loadMultipleServers = useCallback(async () => {
    if (!authSession) return;

    const requestId = ++dashboardRequestIdRef.current;
    goToDashboard();
    setDashboardLoading(true);
    setDashboardError(null);
    setExportMessage(DEFAULT_MESSAGE);
    setEmojis([]);
    setSelectedEmojiIds(new Set());
    setEmojiSearch('');
    setSelectedServer(null);

    try {
      const allEmojis: EmojiItem[] = [];
      const errors: string[] = [];

      for (const server of selectedServers) {
        try {
          const emojiResult = await fetchDiscordJson<EmojiItem[]>(`/guilds/${server.id}/emojis`, authSession.header);
          allEmojis.push(...emojiResult);
        } catch {
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
  }, [authSession, goToDashboard, selectedServers]);

  const handleRetryGuilds = useCallback(() => {
    if (!authSession) return;
    void loadGuilds(authSession);
  }, [authSession, loadGuilds]);

  const handleGuildSelect = useCallback(
    (guild: GuildSummary) => {
      if (multiServerMode) {
        setSelectedServers((prev) => {
          const exists = prev.some((server) => server.id === guild.id);
          if (exists) {
            return prev.filter((server) => server.id !== guild.id);
          }

          return [...prev, { id: guild.id, name: guild.name, icon: guild.icon }];
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
        tone: 'success',
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
    void loadMultipleServers();
  }, [authSession, loadMultipleServers, selectedServers.length]);

  const handleBackToServers = useCallback(() => {
    goToServers();
    setDashboardError(null);
    setExportMessage(DEFAULT_MESSAGE);
  }, [goToServers]);

  const value = useMemo<AppState>(
    () => ({
      tokenInput,
      setTokenInput,
      tokenType,
      setTokenType,
      tokenError,
      clearTokenError,
      tokenNote,
      showToken,
      setShowToken,
      connectLoading,
      authSession,
      guilds,
      guildSearch,
      setGuildSearch,
      guildLoading,
      guildError,
      manualServerId,
      setManualServerId,
      multiServerMode,
      setMultiServerMode,
      selectedServers,
      selectedServer,
      dashboardLoading,
      dashboardError,
      emojis,
      emojiSearch,
      setEmojiSearch,
      selectedEmojiIds,
      exporting,
      exportMessage,
      filteredGuilds,
      filteredEmojis,
      selectedEmojiList,
      allVisibleSelected,
      selectedCount,
      visibleCount,
      selectedServerIcon,
      goToToken,
      goToServers,
      goToDashboard,
      handleConnect,
      handleRetryGuilds,
      handleGuildSelect,
      handleManualServerSubmit,
      handleToggleEmoji,
      handleToggleVisible,
      handleExport,
      handleRetryDashboard,
      handleOpenMultiServerDashboard,
      handleBackToServers,
    }),
    [
      allVisibleSelected,
      authSession,
      connectLoading,
      dashboardError,
      dashboardLoading,
      emojiSearch,
      emojis,
      exportMessage,
      exporting,
      filteredEmojis,
      filteredGuilds,
      goToDashboard,
      goToServers,
      goToToken,
      guildError,
      guildLoading,
      guildSearch,
      guilds,
      handleBackToServers,
      handleConnect,
      handleExport,
      handleGuildSelect,
      handleManualServerSubmit,
      handleOpenMultiServerDashboard,
      handleRetryDashboard,
      handleRetryGuilds,
      handleToggleEmoji,
      handleToggleVisible,
      manualServerId,
      multiServerMode,
      selectedCount,
      selectedEmojiIds,
      selectedEmojiList,
      selectedServer,
      selectedServerIcon,
      selectedServers,
      showToken,
      tokenError,
      clearTokenError,
      tokenInput,
      tokenNote,
      tokenType,
      visibleCount,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
