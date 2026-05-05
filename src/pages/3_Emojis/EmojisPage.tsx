import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../components/AppStateProvider";
import { emojiImageUrl, guildIconUrl } from "../../lib/discord";
import "./emojis.css";

function EmojisPage() {
  const {
    multiServerMode,
    selectedServers,
    selectedServer,
    selectedServerIcon,
    serverEmojiSections,
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

  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const skeletonEmojiCards = Array.from({ length: 12 }, (_, index) => index);

  useEffect(() => {
    if (multiServerMode) {
      setActiveServerId(
        serverEmojiSections[0]?.server.id ?? selectedServers[0]?.id ?? null,
      );
    } else {
      setActiveServerId(selectedServer?.id ?? null);
    }
  }, [
    multiServerMode,
    selectedServer?.id,
    selectedServers,
    serverEmojiSections,
  ]);

  const visibleSections = useMemo(() => {
    if (!multiServerMode) return [];
    return serverEmojiSections;
  }, [multiServerMode, serverEmojiSections]);

  return (
    <section className="dashboard-screen" aria-label="Emoji dashboard">
      <button
        type="button"
        className="back-link dashboard-back"
        onClick={handleBackToServers}
      >
        <span className="chev">‹</span>
        Back
      </button>
      <div className="panel dashboard-shell">
        <header className="dashboard-topbar">
          <div className="server-meta">
            {!multiServerMode && selectedServerIcon ? (
              <img className="server-icon" src={selectedServerIcon} alt="" />
            ) : null}
            {!multiServerMode && !selectedServerIcon ? (
              <span className="server-icon server-fallback">
                {selectedServer?.name?.charAt(0).toUpperCase() ?? "?"}
              </span>
            ) : null}

            {multiServerMode ? (
              <div>
                <p className="multi-server-label">
                  {selectedServers.length} Servers
                </p>
                <h2>Emoji tabs</h2>
              </div>
            ) : (
              <div>
                <h2>{selectedServer?.name ?? "Server"}</h2>
                <p>{emojis.length} emojis</p>
              </div>
            )}
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
              className={`icon-button select-all-toggle ${allVisibleSelected ? "active" : ""}`}
              onClick={handleToggleVisible}
              disabled={visibleCount === 0}
              aria-pressed={allVisibleSelected}
              title={
                allVisibleSelected
                  ? "Deselect all visible emojis"
                  : "Select all visible emojis"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M14 17.5 16.2 19.8 21 14.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </header>

        {dashboardLoading ? (
          multiServerMode ? (
            <div
              className="emoji-sections loading-emoji-sections"
              aria-hidden="true"
            >
              {(selectedServers.length > 0
                ? selectedServers
                : [{ id: "loading-1", name: "Loading server", icon: null }]
              ).map((server, index) => (
                <section
                  key={server.id}
                  className="emoji-section loading-emoji-section"
                >
                  <div className="emoji-section-summary loading-summary">
                    <div className="server-meta section-meta">
                      <span className="server-icon server-fallback skeleton skeleton-circle" />
                      <div className="loading-summary-text">
                        <span className="skeleton skeleton-line skeleton-title" />
                        <span className="skeleton skeleton-line skeleton-subtitle" />
                      </div>
                    </div>
                    <span className="section-chevron loading-chevron">⌄</span>
                  </div>
                  <div className="emoji-grid section-grid loading-grid loading-emoji-grid">
                    {skeletonEmojiCards.map((cardIndex) => (
                      <div
                        key={cardIndex}
                        className="emoji-card skeleton-emoji-card"
                        aria-hidden="true"
                      >
                        <div className="emoji-frame skeleton skeleton-frame" />
                        <span className="skeleton skeleton-line skeleton-emoji-name" />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="emoji-grid loading-emoji-grid" aria-hidden="true">
              {skeletonEmojiCards.map((cardIndex) => (
                <div key={cardIndex} className="emoji-card skeleton-emoji-card">
                  <div className="emoji-frame skeleton skeleton-frame" />
                  <span className="skeleton skeleton-line skeleton-emoji-name" />
                </div>
              ))}
            </div>
          )
        ) : null}

        {!dashboardLoading && dashboardError ? (
          <div className="error-box dashboard-error" role="alert">
            <p>{dashboardError}</p>
            <button
              type="button"
              className="secondary"
              onClick={handleRetryDashboard}
            >
              Retry
            </button>
          </div>
        ) : null}

        {!dashboardLoading && !dashboardError ? (
          multiServerMode ? (
            <div className="emoji-sections">
              {visibleSections.map((section, index) => {
                const sectionEmojis = section.emojis.filter((emoji) =>
                  emoji.name
                    .toLowerCase()
                    .includes(emojiSearch.trim().toLowerCase()),
                );
                const sectionCount = sectionEmojis.length;
                const isFirst = index === 0;
                const isOpen =
                  activeServerId === section.server.id ||
                  (isFirst && activeServerId === null);

                return (
                  <details
                    key={section.server.id}
                    className="emoji-section"
                    open={isOpen}
                    onToggle={(event) => {
                      const target = event.currentTarget;
                      if (target.open) setActiveServerId(section.server.id);
                    }}
                  >
                    <summary className="emoji-section-summary">
                      <div className="server-meta section-meta">
                        {guildIconUrl(section.server) ? (
                          <img
                            className="server-icon"
                            src={guildIconUrl(section.server) ?? ""}
                            alt=""
                          />
                        ) : (
                          <span className="server-icon server-fallback">
                            {section.server.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <h2>{section.server.name}</h2>
                          <p>{sectionCount} emojis</p>
                        </div>
                      </div>
                      <span className="section-chevron" aria-hidden="true">
                        ⌄
                      </span>
                    </summary>

                    <div className="emoji-grid section-grid">
                      {sectionEmojis.map((emoji) => {
                        const selected = selectedEmojiIds.has(emoji.id);

                        return (
                          <button
                            key={emoji.id}
                            type="button"
                            className={`emoji-card ${selected ? "selected" : ""}`}
                            onClick={() => handleToggleEmoji(emoji.id)}
                            aria-pressed={selected}
                          >
                            <div className="emoji-frame">
                              <img
                                className="emoji-image"
                                src={emojiImageUrl(emoji)}
                                alt={emoji.name}
                                loading="lazy"
                              />
                              {selected ? (
                                <span className="emoji-check">✓</span>
                              ) : null}
                            </div>
                            <span className="emoji-name">{emoji.name}</span>
                          </button>
                        );
                      })}

                      {sectionEmojis.length === 0 ? (
                        <div className="empty-state emoji-empty">
                          No emojis found
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="emoji-grid">
              {filteredEmojis.map((emoji) => {
                const selected = selectedEmojiIds.has(emoji.id);

                return (
                  <button
                    key={emoji.id}
                    type="button"
                    className={`emoji-card ${selected ? "selected" : ""}`}
                    onClick={() => handleToggleEmoji(emoji.id)}
                    aria-pressed={selected}
                  >
                    <div className="emoji-frame">
                      <img
                        className="emoji-image"
                        src={emojiImageUrl(emoji)}
                        alt={emoji.name}
                        loading="lazy"
                      />
                      {selected ? <span className="emoji-check">✓</span> : null}
                    </div>
                    <span className="emoji-name">{emoji.name}</span>
                  </button>
                );
              })}

              {filteredEmojis.length === 0 ? (
                <div className="empty-state emoji-empty">No emojis found</div>
              ) : null}
            </div>
          )
        ) : null}
      </div>

      {exportMessage.message ? (
        <div
          className={`export-toast ${exportMessage.tone}`}
          role="status"
          aria-live="polite"
        >
          {exportMessage.message}
        </div>
      ) : null}

      <button
        type="button"
        className="primary export-fab"
        onClick={() => void handleExport()}
        disabled={
          selectedCount === 0 ||
          exporting ||
          dashboardLoading ||
          Boolean(dashboardError)
        }
      >
        {exporting ? "Exporting…" : "Export Emojis"}
      </button>
    </section>
  );
}

export default EmojisPage;
