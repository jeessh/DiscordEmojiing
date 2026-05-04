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

        <label className="field-label" htmlFor="token-input">
          Discord token
        </label>

        <div className="token-tabs">
          <button type="button" className={`token-tab ${tokenType === 'user' ? 'active' : ''}`} onClick={() => setTokenType('user')}>
            User
          </button>
          <button type="button" className={`token-tab ${tokenType === 'bot' ? 'active' : ''}`} onClick={() => setTokenType('bot')}>
            Bot
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
              clearTokenError();
            }}
            placeholder="Paste a Discord token"
            autoComplete="off"
            spellCheck={false}
          />
          <label className="show-token-label">
            <input type="checkbox" checked={showToken} onChange={() => setShowToken((current) => !current)} />
            Show
          </label>
        </div>

        {tokenNote ? (
          <p className="note" aria-live="polite">
            {tokenNote}
          </p>
        ) : null}

        <div className="token-instructions">
          <div className="instruction-block">
            <strong>User token (desktop Discord)</strong>
            <ol>
              <li>Open Discord in a desktop browser.</li>
              <li>Open Developer Tools (Cmd+Option+I / Ctrl+Shift+I).</li>
              <li>
                Go to Application → Local Storage → https://discord.com and find the <code>token</code> key.
              </li>
              <li>Copy the value and paste here.</li>
            </ol>
            <p className="note">
              You can also run <code>copy(localStorage.getItem('token'))</code> in Console.
            </p>
          </div>
          {tokenType === 'bot' ? (
            <div className="instruction-block">
              <strong>Bot token (Developer Portal)</strong>
              <ol>
                <li>
                  Open{' '}
                  <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">
                    Discord Developer Portal
                  </a>
                  .
                </li>
                <li>Select your application, open the Bot section, and create a bot if needed.</li>
                <li>Click Reset Token or Copy to reveal and copy the bot token.</li>
                <li>Paste the token here. The app will prefix Bot automatically if needed.</li>
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
