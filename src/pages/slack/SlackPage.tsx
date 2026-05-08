import { useMemo, useState, type FormEvent } from 'react';
import {
  fetchSlackEmojis,
  formatSlackError,
  isLikelyNetworkError,
  isSlackDuplicateError,
  isSlackNotAdminError,
  isSlackUserToken,
  sanitizeSlackToken,
  type SlackEmojiItem,
  type SlackWorkspace,
  uploadSlackEmoji,
  verifySlackWorkspace,
} from '../../lib/slack';
import '../3_Emojis/emojis.css';
import './slack.css';

type ModalStep = 'token' | 'confirm' | 'transferring' | 'paused' | 'summary';
type TransferStatus = 'pending' | 'success' | 'skipped' | 'failed';

function SlackPage() {
  const [sourceTokenInput, setSourceTokenInput] = useState('');
  const [sourceToken, setSourceToken] = useState('');
  const [sourceWorkspace, setSourceWorkspace] = useState<SlackWorkspace | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [emojiLoading, setEmojiLoading] = useState(false);
  const [emojiError, setEmojiError] = useState<string | null>(null);
  const [sourceEmojis, setSourceEmojis] = useState<SlackEmojiItem[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [selectedEmojiNames, setSelectedEmojiNames] = useState<Set<string>>(new Set());

  const [destinationTokenInput, setDestinationTokenInput] = useState('');
  const [destinationToken, setDestinationToken] = useState('');
  const [destinationWorkspace, setDestinationWorkspace] = useState<SlackWorkspace | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('token');
  const [transferStatus, setTransferStatus] = useState<Record<string, TransferStatus>>({});
  const [transferQueue, setTransferQueue] = useState<string[]>([]);

  const sourceConnected = sourceWorkspace !== null;

  const filteredEmojis = useMemo(() => {
    const query = emojiSearch.trim().toLowerCase();
    if (!query) return sourceEmojis;

    return sourceEmojis.filter((emoji) => emoji.name.toLowerCase().includes(query));
  }, [emojiSearch, sourceEmojis]);

  const emojiLookup = useMemo(() => {
    return new Map(sourceEmojis.map((emoji) => [emoji.name, emoji]));
  }, [sourceEmojis]);

  const selectedEmojiList = useMemo(
    () => sourceEmojis.filter((emoji) => selectedEmojiNames.has(emoji.name)),
    [selectedEmojiNames, sourceEmojis],
  );

  const selectedCount = selectedEmojiNames.size;

  const allVisibleSelected = useMemo(
    () => filteredEmojis.length > 0 && filteredEmojis.every((emoji) => selectedEmojiNames.has(emoji.name)),
    [filteredEmojis, selectedEmojiNames],
  );

  const transferTotal = useMemo(() => Object.keys(transferStatus).length, [transferStatus]);

  const transferSuccessCount = useMemo(
    () => Object.values(transferStatus).filter((status) => status === 'success').length,
    [transferStatus],
  );

  const transferSkippedCount = useMemo(
    () => Object.values(transferStatus).filter((status) => status === 'skipped').length,
    [transferStatus],
  );

  const transferFailedNames = useMemo(
    () => Object.entries(transferStatus)
      .filter(([, status]) => status === 'failed')
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b)),
    [transferStatus],
  );

  const transferCompleted = useMemo(
    () => Object.values(transferStatus).filter((status) => status !== 'pending').length,
    [transferStatus],
  );

  const retryCount = transferQueue.length;

  const toggleEmoji = (name: string) => {
    setSelectedEmojiNames((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleVisible = () => {
    const visible = filteredEmojis.map((emoji) => emoji.name);

    setSelectedEmojiNames((current) => {
      const next = new Set(current);
      const isAllSelected = visible.length > 0 && visible.every((name) => next.has(name));

      if (isAllSelected) {
        visible.forEach((name) => next.delete(name));
      } else {
        visible.forEach((name) => next.add(name));
      }

      return next;
    });
  };

  const resetModalState = () => {
    setDestinationTokenInput('');
    setDestinationToken('');
    setDestinationWorkspace(null);
    setDestinationError(null);
    setDestinationLoading(false);
    setTransferStatus({});
    setTransferQueue([]);
    setModalStep('token');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModalState();
  };

  const initializeTransferStatus = () => {
    const initial: Record<string, TransferStatus> = {};
    selectedEmojiList.forEach((emoji) => {
      initial[emoji.name] = 'pending';
    });
    setTransferStatus(initial);
    return initial;
  };

  const loadSourceWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = sanitizeSlackToken(sourceTokenInput);
    if (!token) {
      setSourceError('Token is required.');
      return;
    }

    if (!isSlackUserToken(token)) {
      setSourceError('Use a Slack user token that starts with xoxp-.');
      return;
    }

    setSourceLoading(true);
    setSourceError(null);
    setEmojiError(null);

    let verified = false;

    try {
      const workspace = await verifySlackWorkspace(token);
      setSourceToken(token);
      setSourceWorkspace(workspace);
      setSelectedEmojiNames(new Set());
      setEmojiSearch('');
      setSourceEmojis([]);
      setEmojiLoading(true);
      verified = true;
    } catch (error) {
      setSourceWorkspace(null);
      setSourceToken('');
      setSourceEmojis([]);
      setSourceError(formatSlackError(error, 'Invalid token.'));
    } finally {
      setSourceLoading(false);
    }

    if (!verified) {
      return;
    }

    try {
      const emojis = await fetchSlackEmojis(token);
      setSourceEmojis(emojis);
    } catch (error) {
      setEmojiError(formatSlackError(error, 'Failed to load emojis.'));
    } finally {
      setEmojiLoading(false);
    }
  };

  const retryEmojiLoad = async () => {
    if (!sourceToken) return;

    setEmojiLoading(true);
    setEmojiError(null);

    try {
      const emojis = await fetchSlackEmojis(sourceToken);
      setSourceEmojis(emojis);
    } catch (error) {
      setEmojiError(formatSlackError(error, 'Failed to load emojis.'));
    } finally {
      setEmojiLoading(false);
    }
  };

  const verifyDestination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = sanitizeSlackToken(destinationTokenInput);
    if (!token) {
      setDestinationError('Destination token is required.');
      return;
    }

    if (!isSlackUserToken(token)) {
      setDestinationError('Use a Slack user token that starts with xoxp-.');
      return;
    }

    setDestinationLoading(true);
    setDestinationError(null);

    try {
      const workspace = await verifySlackWorkspace(token);
      setDestinationToken(token);
      setDestinationWorkspace(workspace);
      setModalStep('confirm');
    } catch (error) {
      setDestinationWorkspace(null);
      setDestinationToken('');
      setDestinationError(formatSlackError(error, 'Invalid destination token.'));
    } finally {
      setDestinationLoading(false);
    }
  };

  const runTransfer = async (queueNames: string[], baseStatus?: Record<string, TransferStatus>) => {
    if (!sourceToken || !destinationToken || queueNames.length === 0) {
      return;
    }

    setModalStep('transferring');
    setTransferQueue([]);

    const statusMap: Record<string, TransferStatus> = { ...(baseStatus ?? transferStatus) };

    for (let index = 0; index < queueNames.length; index += 1) {
      const emojiName = queueNames[index];
      const emoji = emojiLookup.get(emojiName);

      if (!emoji) {
        statusMap[emojiName] = 'failed';
        setTransferStatus({ ...statusMap });
        continue;
      }

      try {
        const imageResponse = await fetch(emoji.url, {
          headers: {
            Authorization: `Bearer ${sourceToken}`,
          },
        });

        if (!imageResponse.ok) {
          statusMap[emojiName] = 'failed';
          setTransferStatus({ ...statusMap });
          continue;
        }

        const imageBlob = await imageResponse.blob();
        const uploadResult = await uploadSlackEmoji(destinationToken, emoji.name, imageBlob);

        if (uploadResult.ok) {
          statusMap[emojiName] = 'success';
        } else if (isSlackDuplicateError(uploadResult.error)) {
          statusMap[emojiName] = 'skipped';
        } else if (isSlackNotAdminError(uploadResult.error)) {
          setDestinationError("Your destination token doesn't have admin permissions");
          setModalStep('token');
          setTransferStatus({ ...statusMap });
          return;
        } else {
          statusMap[emojiName] = 'failed';
        }

        setTransferStatus({ ...statusMap });
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          const pendingRetry = queueNames.slice(index).filter((name) => statusMap[name] === 'pending');
          setTransferQueue(pendingRetry);
          setTransferStatus({ ...statusMap });
          setModalStep('paused');
          return;
        }

        statusMap[emojiName] = 'failed';
        setTransferStatus({ ...statusMap });
      }
    }

    setTransferQueue([]);
    setTransferStatus({ ...statusMap });
    setModalStep('summary');
  };

  const beginTransfer = async () => {
    const initial = initializeTransferStatus();
    await runTransfer(Object.keys(initial), initial);
  };

  const retryTransfer = async () => {
    if (transferQueue.length === 0) return;
    await runTransfer(transferQueue);
  };

  const openTransferModal = () => {
    if (selectedCount === 0) return;
    setIsModalOpen(true);
    resetModalState();
  };

  const handleDone = () => {
    closeModal();
    setSelectedEmojiNames(new Set());
  };

  return (
    <section className="slack-screen" aria-label="Slack emoji transfer">
      {!sourceConnected ? (
        <section className="auth-screen" aria-label="Slack token login">
          <form className="auth-card panel" onSubmit={loadSourceWorkspace}>
            <h1 className="app-title">Slack Emoji Transfer</h1>

            <div className="token-input-wrapper">
              <input
                className="token-input"
                type="password"
                value={sourceTokenInput}
                onChange={(event) => {
                  setSourceTokenInput(event.target.value);
                  setSourceError(null);
                }}
                placeholder="Paste a Slack user token (xoxp-)"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <p className="note with-info">
              Requires a user token with emoji:read permissions
              <span className="info-badge" title="Slack user tokens begin with xoxp-. Bot tokens do not support emoji permissions.">
                i
              </span>
            </p>

            <div className="token-instructions">
              <div className="instruction-block">
                <ol style={{ margin: 0 }}>
                  <li>Open your Slack workspace in a desktop browser.</li>
                  <li>Open Dev Tools/Inspect Element (Cmd+Option+I / Ctrl+Shift+I / F12).</li>
                  <li>Go to Application → Local Storage and find your workspace URL.</li>
                  <li>Look for the <code>xoxp-</code> token in the stored data, or use the Slack mobile app's token.</li>
                  <li>Copy and paste the token below. It must start with <code>xoxp-</code>.</li>
                </ol>
                <p className="note" style={{ marginTop: '0.6rem' }}>
                  Alternatively, generate a user token via your Slack workspace settings under integrations.
                </p>
              </div>
            </div>

            {sourceError ? (
              <p className="inline-error" role="alert">
                {sourceError}
              </p>
            ) : null}

            <button type="submit" className="primary connect-button" disabled={sourceLoading}>
              {sourceLoading ? 'Connecting…' : 'Connect'}
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="panel dashboard-shell">
            <header className="dashboard-topbar">
              <div className="server-meta">
                <span className="server-icon server-fallback">
                  {sourceWorkspace.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h2>{sourceWorkspace.name}</h2>
                  <p>
                    {sourceWorkspace.domain}.slack.com · {sourceEmojis.length} emojis
                  </p>
                </div>
              </div>

              <div className="dashboard-controls">
                <input
                  className="search-input compact-search"
                  type="search"
                  value={emojiSearch}
                  onChange={(event) => setEmojiSearch(event.target.value)}
                  placeholder="Search emojis"
                />
                <button
                  type="button"
                  className={`icon-button select-all-toggle ${allVisibleSelected ? 'active' : ''}`}
                  onClick={toggleVisible}
                  disabled={filteredEmojis.length === 0}
                  aria-pressed={allVisibleSelected}
                  title={allVisibleSelected ? 'Deselect all visible emojis' : 'Select all visible emojis'}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M14 17.5 16.2 19.8 21 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </header>

            {emojiLoading ? (
              <div className="emoji-grid loading-emoji-grid" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => (
                  <div key={index} className="emoji-card skeleton-emoji-card">
                    <div className="emoji-frame skeleton skeleton-frame" />
                    <span className="skeleton skeleton-line skeleton-emoji-name" />
                  </div>
                ))}
              </div>
            ) : null}

            {!emojiLoading && emojiError ? (
              <div className="error-box dashboard-error" role="alert">
                <p>{emojiError}</p>
                <button type="button" className="secondary" onClick={() => void retryEmojiLoad()}>
                  Retry
                </button>
              </div>
            ) : null}

            {!emojiLoading && !emojiError ? (
              <div className="emoji-grid">
                {filteredEmojis.map((emoji) => {
                  const selected = selectedEmojiNames.has(emoji.name);

                  return (
                    <button
                      key={emoji.name}
                      type="button"
                      className={`emoji-card ${selected ? 'selected' : ''}`}
                      onClick={() => toggleEmoji(emoji.name)}
                      aria-pressed={selected}
                    >
                      <div className="emoji-frame">
                        <img className="emoji-image" src={emoji.url} alt={emoji.name} loading="lazy" />
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

          <button
            type="button"
            className="primary export-fab"
            onClick={openTransferModal}
            disabled={selectedCount === 0 || emojiLoading || Boolean(emojiError)}
          >
            Transfer {selectedCount} Emojis
          </button>
        </>
      )}

      {isModalOpen ? (
        <div className="slack-modal-overlay" role="dialog" aria-modal="true" aria-label="Destination workspace transfer">
          <div className="panel slack-modal">
            {modalStep === 'token' ? (
              <form className="slack-modal-body" onSubmit={verifyDestination}>
                <h3>Destination workspace</h3>
                <input
                  className="token-input"
                  type="password"
                  value={destinationTokenInput}
                  onChange={(event) => {
                    setDestinationTokenInput(event.target.value);
                    setDestinationError(null);
                  }}
                  placeholder="Paste destination Slack user token (xoxp-)"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="note with-info">
                  Must be a user token with admin permissions in the target workspace
                  <span
                    className="info-badge"
                    title="The destination user must be an admin or owner to upload via emoji.add."
                  >
                    i
                  </span>
                </p>

                {destinationError ? (
                  <p className="inline-error" role="alert">
                    {destinationError}
                  </p>
                ) : null}

                <div className="slack-modal-actions">
                  <button type="button" className="secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={destinationLoading}>
                    {destinationLoading ? 'Verifying…' : 'Verify & Transfer'}
                  </button>
                </div>
              </form>
            ) : null}

            {modalStep === 'confirm' && destinationWorkspace ? (
              <div className="slack-modal-body">
                <h3>Confirm transfer</h3>
                <p>
                  Transfer {selectedCount} emojis to {destinationWorkspace.name}?
                </p>
                <p className="note">{destinationWorkspace.domain}.slack.com</p>
                <div className="slack-modal-actions">
                  <button type="button" className="secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="button" className="primary" onClick={() => void beginTransfer()}>
                    Confirm
                  </button>
                </div>
              </div>
            ) : null}

            {modalStep === 'transferring' ? (
              <div className="slack-modal-body">
                <h3>Transferring emojis</h3>
                <p>
                  {transferCompleted} / {transferTotal} transferred...
                </p>
                <div className="transfer-progress-track" aria-hidden="true">
                  <div
                    className="transfer-progress-fill"
                    style={{ width: `${transferTotal > 0 ? (transferCompleted / transferTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : null}

            {modalStep === 'paused' ? (
              <div className="slack-modal-body">
                <h3>Transfer paused</h3>
                <p className="inline-error" role="alert">
                  Network interruption detected. {transferCompleted} / {transferTotal} completed so far.
                </p>
                <div className="slack-modal-actions">
                  <button type="button" className="secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="button" className="primary" onClick={() => void retryTransfer()}>
                    Retry Failed ({retryCount})
                  </button>
                </div>
              </div>
            ) : null}

            {modalStep === 'summary' ? (
              <div className="slack-modal-body">
                <h3>Transfer summary</h3>
                <p>✅ {transferSuccessCount} emojis transferred successfully</p>
                <p>⚠️ {transferSkippedCount} skipped — name already exists in destination</p>
                <p>❌ {transferFailedNames.length} failed</p>

                {transferFailedNames.length > 0 ? (
                  <div className="failed-list" aria-label="Failed emoji names">
                    {transferFailedNames.join(', ')}
                  </div>
                ) : null}

                <div className="slack-modal-actions">
                  <button type="button" className="primary" onClick={handleDone}>
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SlackPage;
