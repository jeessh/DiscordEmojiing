import { useAppState } from '../../components/AppStateProvider';
import './token.css';

function TokenPage() {
  const {
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
    handleConnect,
  } = useAppState();

  return (
    <section className="auth-screen" aria-label="Discord token login">
      <form className="auth-card panel" onSubmit={handleConnect}>
        <h1 className="app-title">Discord Emoji Exporter</h1>

        <div className="token-tabs">
          <button type="button" className={`token-tab ${tokenType === 'user' ? 'active' : ''}`} onClick={() => setTokenType('user')}>
            User token
          </button>
          <button type="button" className={`token-tab ${tokenType === 'bot' ? 'active' : ''}`} onClick={() => setTokenType('bot')}>
            Bot token
          </button>
        </div>

        <div className="token-input-wrapper">
          <input
            id="token-input"
            className="token-input"
            type={showToken ? 'text' : 'password'}
            value={tokenInput}
            onChange={(event) => {
              setTokenInput(event.target.value);
              clearTokenError?.();
            }}
            placeholder="Paste a Discord token"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="show-token-row">
          <label>
            <input type="checkbox" checked={showToken} onChange={() => setShowToken((current) => !current)} style={{ marginRight: '0.5rem' }} />
            Show Token
          </label>
        </div>

        {tokenNote ? (
          <p className="note" aria-live="polite">
            {tokenNote}
          </p>
        ) : null}

        <div className="token-instructions">
          {tokenType === 'user' ? (
            <div className="instruction-block">
              <ol style={{ margin: 0 }}>
                <li>Open Discord in a desktop browser.</li>
                <li>Open Dev Tools/Inspect Element (Cmd+Option+I / Ctrl+Shift+I / F12).</li>
                <li>Application → Local Storage → https://discord.com and find the <code>token</code> key.</li>
                <li>Copy the value and paste. Quotations will be auto removed for convenience :3</li>
              </ol>
              <p className="note" style={{ marginTop: '0.6rem' }}>
                You can also run <code>copy(localStorage.getItem('token'))</code> in Console.
              </p>
            </div>
          ) : null}

          {tokenType === 'bot' ? (
            <div className="instruction-block">
              <ol style={{ margin: 0 }}>
                <li>
                  Open <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a>.
                </li>
                <li>Select your application, open the Bot section, and create a bot if needed.</li>
                <li>Click Reset Token or Copy to reveal and copy the bot token.</li>
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
  );
}

export default TokenPage;

