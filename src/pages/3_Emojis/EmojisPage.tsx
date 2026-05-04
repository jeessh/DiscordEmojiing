import { useAppState } from '../../components/AppStateProvider';
import { emojiImageUrl } from '../../lib/discord';
import './emojis.css';

function EmojisPage() {
  const {
    multiServerMode,
    selectedServers,
    selectedServer,
    selectedServerIcon,
    emojis,
    filteredEmojis,
    emojiSearch,
    setEmojiSearch,
    dashboardLoading,
    dashboardError,
    selectedEmojiIds,
    selectedCount,
    allVisibleSelected,
    visibleCount,
    exporting,
    exportMessage,
    handleToggleVisible,
    handleToggleEmoji,
    handleRetryDashboard,
    handleBackToServers,
    handleExport,
  } = useAppState();

  return (
    <section className="dashboard-screen" aria-label="Emoji dashboard">
      <div className="panel dashboard-shell">
        <header className="dashboard-topbar">
          <div className="server-meta">
            {!multiServerMode && selectedServerIcon ? <img className="server-icon" src={selectedServerIcon} alt="" /> : null}
            {multiServerMode ? (
              <div>
                <p className="multi-server-label">{selectedServers.length} Servers</p>
                <h2>{selectedServers.map((server) => server.name).join(', ')}</h2>
              </div>
            ) : (
              <>
                {selectedServerIcon ? null : (
                  <span className="server-icon server-fallback">
                    {selectedServer?.name?.charAt(0).toUpperCase() ?? '?'}
                  </span>
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
              className="search-input compact-search"
              type="search"
              value={emojiSearch}
              onChange={(event) => setEmojiSearch(event.target.value)}
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

      {exportMessage.message ? (
        <div className={`export-toast ${exportMessage.tone}`} role="status" aria-live="polite">
          {exportMessage.message}
        </div>
      ) : null}

      <button
        type="button"
        className="export-fab"
        onClick={() => void handleExport()}
        disabled={selectedCount === 0 || exporting || dashboardLoading || Boolean(dashboardError)}
      >
        {exporting ? 'Exporting…' : `Export ${selectedCount} Emojis`}
      </button>
    </section>
  );
}

export default EmojisPage;
