import { useAppState } from '../../components/AppStateProvider';
import { guildIconUrl } from '../../lib/discord';
import './servers.css';

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
    manualServerId,
    setManualServerId,
    handleManualServerSubmit,
    handleOpenMultiServerDashboard,
  } = useAppState();

  return (
    <section className="servers-screen" aria-label="Server selection">
      <div className="panel servers-card">
        <div className="section-header compact-header">
          <div>
            <p className="section-label">Servers</p>
            <h2>Select a server</h2>
          </div>
          <button type="button" className="secondary compact-action" onClick={goToToken}>
            Change token
          </button>
        </div>

        <input
          className="search-input"
          type="search"
          value={guildSearch}
          onChange={(event) => setGuildSearch(event.target.value)}
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

        <div className="selection-row">
          <label className="field-label selection-label">
            <input
              type="checkbox"
              checked={multiServerMode}
              onChange={() => setMultiServerMode(!multiServerMode)}
            />
            Select multiple servers
          </label>
        </div>

        <div className="guild-list" role="list" aria-label="Available servers">
          {filteredGuilds.length > 0 ? (
            filteredGuilds.map((guild) => {
              const icon = guildIconUrl(guild);
              const isSelected = selectedServers.some((server) => server.id === guild.id);

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
                      onClick={(event) => event.stopPropagation()}
                      className="guild-check"
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
            className="primary multi-view-button"
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
              onChange={(event) => setManualServerId(event.target.value)}
              placeholder="Paste server ID"
            />
            <button type="submit" className="primary manual-button">
              Use ID
            </button>
          </div>
        </form>

        <div className="server-id-instructions">
          <p className="note">
            To copy a Server ID: enable <strong>Developer Mode</strong> in Discord Settings → Advanced, then
            right-click a server icon and choose Copy ID.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ServersPage;
