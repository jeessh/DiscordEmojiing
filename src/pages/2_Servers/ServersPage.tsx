import { useAppState } from "../../components/AppStateProvider";
import { guildIconUrl } from "../../lib/discord";
import "./servers.css";

function ServersPage() {
  const {
    goToToken,
    guildSearch,
    setGuildSearch,
    guildLoading,
    guildError,
    filteredGuilds,
    multiServerMode,
    setMultiServerMode,
    selectedServers,
    handleRetryGuilds,
    handleGuildSelect,
    handleOpenMultiServerDashboard,
  } = useAppState();

  const skeletonGuilds = Array.from({ length: 9 }, (_, index) => index);

  return (
    <section className="servers-screen" aria-label="Server selection">
      <button type="button" className="back-link" onClick={goToToken}>
        <span className="chev">‹</span>
        Back
      </button>
      <div className="panel servers-card">
        <div className="back-row"></div>
        <div className="section-header compact-header">
          <div>
            <p className="section-label">Servers</p>
            <h2>Select a server</h2>
          </div>
        </div>

        <div className="search-row">
          <input
            className="search-input compact-search"
            type="search"
            value={guildSearch}
            onChange={(event) => setGuildSearch(event.target.value)}
            placeholder="Search servers"
          />
          <button
            type="button"
            className={`icon-button multi-toggle ${multiServerMode ? "active" : ""}`}
            onClick={() => setMultiServerMode(!multiServerMode)}
            aria-pressed={multiServerMode}
            title="Toggle multi-select"
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
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>

        {guildLoading ? (
          <div className="loading-grid servers-loading" aria-hidden="true">
            {skeletonGuilds.map((index) => (
              <div key={index} className="guild-item skeleton-card">
                <span className="guild-icon skeleton skeleton-circle" />
                <span className="skeleton skeleton-line skeleton-name" />
              </div>
            ))}
          </div>
        ) : null}
        {!guildLoading && guildError ? (
          <div className="error-box" role="alert">
            <p>{guildError}</p>
            <button
              type="button"
              className="secondary"
              onClick={handleRetryGuilds}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* selection controls moved into the search row */}

        {!guildLoading ? (
          <div className="guild-list" role="list" aria-label="Available servers">
            {filteredGuilds.length > 0 ? (
            filteredGuilds.map((guild) => {
              const icon = guildIconUrl(guild);
              const isSelected = selectedServers.some(
                (server) => server.id === guild.id,
              );

              return (
                <button
                  key={guild.id}
                  type="button"
                  className={`guild-item ${multiServerMode && isSelected ? "selected" : ""}`}
                  onClick={() => handleGuildSelect(guild)}
                >
                  {icon ? (
                    <img className="guild-icon" src={icon} alt="" />
                  ) : (
                    <span className="guild-icon guild-fallback">
                      {guild.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="guild-name">{guild.name}</span>
                </button>
              );
            })
            ) : (
              <div className="empty-state compact-empty">No servers found</div>
            )}
          </div>
        ) : null}

        {/* Floating fetch button handled below when multi select active */}
        {/* manual server ID removed per request */}
      </div>

      {multiServerMode ? (
        <button
          type="button"
          className={`fetch-emojis ${selectedServers.length === 0 ? "disabled" : ""}`}
          onClick={() => void handleOpenMultiServerDashboard()}
          aria-disabled={selectedServers.length === 0}
        >
          Fetch Emojis
        </button>
      ) : null}
    </section>
  );
}

export default ServersPage;
