import {
  AlertCircle,
  CheckCircle2,
  Info,
  KeyRound,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useState } from 'react';
import type { ConnectionSettings, SessionStatus } from '../types/iperal';

interface SessionViewProps {
  sessionStatus: SessionStatus;
  connectionSettings: ConnectionSettings;
  apiKey: string;
  profileName: string;
  onChangeProfileName: (name: string) => void;
  onChangeApiKey: (nextKey: string) => void;
  onChangeConnectionSettings: (next: ConnectionSettings) => void;
  onSubmitCredentials: (payload: {
    jsessionid?: string;
    ebsnAccount?: string;
    cookieString?: string;
  }) => Promise<{ ok: boolean; message: string }>;
  onVerifyLiveSession: () => Promise<{ ok: boolean; message: string }>;
  onClearSession: () => Promise<void>;
  onGoToCatalog: () => void;
}

export function SessionView({
  sessionStatus,
  connectionSettings,
  apiKey,
  profileName,
  onChangeProfileName,
  onChangeApiKey,
  onChangeConnectionSettings,
  onSubmitCredentials,
  onVerifyLiveSession,
  onClearSession,
  onGoToCatalog,
}: SessionViewProps) {
  const [inputMode, setInputMode] = useState<'split' | 'cookie'>('split');
  const [jsessionid, setJsessionid] = useState('');
  const [ebsnAccount, setEbsnAccount] = useState('');
  const [cookieString, setCookieString] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingLive, setVerifyingLive] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === 'split' && sessionStatus.authenticated && !jsessionid.trim() && !ebsnAccount.trim()) {
      setFeedback({
        type: 'error',
        message: 'Inserisci almeno un nuovo valore per aggiornare la sessione attiva.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const payload =
      inputMode === 'cookie'
        ? { cookieString }
        : { jsessionid, ebsnAccount };

    const result = await onSubmitCredentials(payload);
    setSubmitting(false);
    setFeedback({
      type: result.ok ? 'success' : 'error',
      message: result.message,
    });

    if (result.ok) {
      setJsessionid('');
      setEbsnAccount('');
      setCookieString('');
    }
  };

  const handleVerifyLive = async () => {
    setVerifyingLive(true);
    setFeedback(null);
    const result = await onVerifyLiveSession();
    setVerifyingLive(false);
    setFeedback({
      type: result.ok ? 'success' : 'error',
      message: result.message,
    });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Impostazioni, Profilo e Sessione Iperal
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Collega la tua sessione autenticata di{' '}
          <span className="font-medium text-[var(--text-primary)]">
            iperalspesaonline.it
          </span>{' '}
          per scaricare il catalogo live ordinato per prezzo al kg e inviare il carrello.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {sessionStatus.authenticated ? (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--best-value)]"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]"
                aria-hidden="true"
              />
            )}
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                {sessionStatus.authenticated
                  ? 'Sessione Iperal attiva e salvata'
                  : 'Sessione non ancora configurata'}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {sessionStatus.authenticated
                  ? sessionStatus.source === 'env'
                    ? 'Credenziali caricate dal file .env del server e mantenute al ricaricamento pagina.'
                    : 'Credenziali salvate nella sessione cifrata del server (restano attive anche ricaricando la pagina).'
                  : 'Inserisci JSESSIONID e X-Ebsn-Account (oppure incolla Cookie / cURL) per accedere al catalogo.'}
              </p>

              {sessionStatus.authenticated &&
                (sessionStatus.maskedJsessionid || sessionStatus.maskedEbsnAccount) && (
                  <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
                    {sessionStatus.maskedJsessionid && (
                      <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[var(--text-secondary)]">
                        JSESSIONID: <strong className="text-[var(--text-primary)]">{sessionStatus.maskedJsessionid}</strong>
                      </span>
                    )}
                    {sessionStatus.maskedEbsnAccount && (
                      <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[var(--text-secondary)]">
                        X-Ebsn-Account: <strong className="text-[var(--text-primary)]">{sessionStatus.maskedEbsnAccount}</strong>
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {sessionStatus.authenticated && (
              <>
                {connectionSettings.backendMode === 'integrated' && (
                  <button
                    type="button"
                    onClick={handleVerifyLive}
                    disabled={verifyingLive}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${verifyingLive ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{verifyingLive ? 'Verifica...' : 'Verifica e rinnova'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearSession}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Disconnetti</span>
                </button>
                <button
                  type="button"
                  onClick={onGoToCatalog}
                  className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                >
                  Vai al catalogo
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Credenziali sessione Iperal
            </h2>

            <div className="inline-flex rounded-lg bg-[var(--surface-subtle)] p-1">
              <button
                type="button"
                onClick={() => setInputMode('split')}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  inputMode === 'split'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Campi separati
              </button>
              <button
                type="button"
                onClick={() => setInputMode('cookie')}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  inputMode === 'cookie'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Incolla Cookie / cURL
              </button>
            </div>
          </div>

          {inputMode === 'split' ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="jsessionid-input"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  JSESSIONID
                </label>
                <input
                  id="jsessionid-input"
                  type="password"
                  autoComplete="off"
                  value={jsessionid}
                  onChange={(e) => setJsessionid(e.target.value)}
                  placeholder={
                    sessionStatus.maskedJsessionid
                      ? `Già salvato (${sessionStatus.maskedJsessionid}) — incolla solo per sostituirlo`
                      : 'Incolla il valore del cookie JSESSIONID'
                  }
                  required={!sessionStatus.authenticated}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="ebsn-account-input"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  X-Ebsn-Account
                </label>
                <input
                  id="ebsn-account-input"
                  type="password"
                  autoComplete="off"
                  value={ebsnAccount}
                  onChange={(e) => setEbsnAccount(e.target.value)}
                  placeholder={
                    sessionStatus.maskedEbsnAccount
                      ? `Già salvato (${sessionStatus.maskedEbsnAccount}) — incolla solo per sostituirlo`
                      : 'Incolla il valore del cookie X-Ebsn-Account'
                  }
                  required={!sessionStatus.authenticated}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="cookie-string-input"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Header Cookie o comando Copy as cURL da DevTools
              </label>
              <textarea
                id="cookie-string-input"
                rows={4}
                value={cookieString}
                onChange={(e) => setCookieString(e.target.value)}
                placeholder="Incolla l'intera riga Cookie o 'Copy as cURL (bash)' da DevTools (verranno estratti JSESSIONID e X-Ebsn-Account)..."
                required
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5 font-mono text-xs text-[var(--text-primary)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
              />
            </div>
          )}

          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <KeyRound className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
              <span>
                Chiave API del server domestico{' '}
                {sessionStatus.apiKeyRequired ? '(Obbligatoria)' : '(Opzionale)'}
              </span>
            </div>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              placeholder="Se hai impostato IPERAL_PROXY_API_KEY nel file .env, inseriscila qui"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              La chiave viene tenuta solo nella memoria della sessione corrente del
              browser e inviata nell&apos;header <span className="font-mono">X-Api-Key</span>.
            </p>
          </div>

          {feedback && (
            <div
              role="status"
              className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                feedback.type === 'success'
                  ? 'border-[var(--best-value)]/30 bg-[var(--best-value-soft)] text-[var(--best-value)]'
                  : 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>
              {submitting ? 'Verifica e connessione...' : 'Connetti e carica catalogo'}
            </span>
          </button>

          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <div>
              <span className="font-semibold text-[var(--text-primary)]">
                Perché non c&apos;è un login diretto con email/password qui?
              </span>{' '}
              L&apos;accesso di{' '}
              <span className="font-medium text-[var(--text-primary)]">
                iperalspesaonline.it
              </span>{' '}
              è protetto da Google reCAPTCHA Enterprise legato al dominio ufficiale e
              imposta <span className="font-mono">JSESSIONID</span> come cookie{' '}
              <span className="font-mono">HttpOnly</span>. Dopo l&apos;accesso sul sito
              Iperal, puoi usare <strong className="text-[var(--text-primary)]">Incolla Cookie / cURL</strong>{' '}
              oppure salvare i valori nel file <span className="font-mono">.env</span> del
              server domestico (insieme a <span className="font-mono">IPERAL_SESSION_SECRET</span>);
              il server aggiornerà automaticamente i cookie ruotati da Iperal.
            </div>
          </div>
        </form>

        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Nome profilo
              </h3>
            </div>
            <input
              type="text"
              value={profileName}
              maxLength={32}
              onChange={(e) => onChangeProfileName(e.target.value)}
              placeholder="Es. Christian"
              aria-label="Nome visualizzato nel menu profilo"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Come recuperare i cookie in 10 secondi
            </h3>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--text-primary)]">01.</span> Accedi
                su{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  iperalspesaonline.it
                </span>{' '}
                e seleziona il tuo punto vendita.
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">02.</span> Apri
                DevTools (F12) → <span className="font-medium text-[var(--text-primary)]">Network</span>,
                clicca una chiamata API → tasto destro →{' '}
                <span className="font-medium text-[var(--text-primary)]">Copy as cURL</span>{' '}
                (oppure leggi i valori da <span className="font-medium text-[var(--text-primary)]">Application → Cookies</span>).
              </li>
              <li>
                <span className="font-semibold text-[var(--text-primary)]">03.</span> Incolla
                qui a fianco in <span className="font-medium text-[var(--text-primary)]">Incolla Cookie / cURL</span>:
                i cookie restano salvati al ricaricamento pagina.
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Modalità Backend
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] p-2.5 hover:bg-[var(--surface-subtle)]">
                <input
                  type="radio"
                  name="backend-mode"
                  checked={connectionSettings.backendMode === 'integrated'}
                  onChange={() =>
                    onChangeConnectionSettings({
                      ...connectionSettings,
                      backendMode: 'integrated',
                    })
                  }
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    Server integrato (/api)
                  </p>
                  <p className="text-[var(--text-muted)]">
                    Consigliato per Docker e comando singolo.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] p-2.5 hover:bg-[var(--surface-subtle)]">
                <input
                  type="radio"
                  name="backend-mode"
                  checked={connectionSettings.backendMode === 'external'}
                  onChange={() =>
                    onChangeConnectionSettings({
                      ...connectionSettings,
                      backendMode: 'external',
                    })
                  }
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div className="flex-1">
                  <p className="font-semibold text-[var(--text-primary)]">
                    Server Flask esterno
                  </p>
                  <p className="text-[var(--text-muted)]">
                    Indirizzo del tuo server.py locale.
                  </p>
                </div>
              </label>

              {connectionSettings.backendMode === 'external' && (
                <input
                  type="url"
                  value={connectionSettings.externalBaseUrl}
                  onChange={(e) =>
                    onChangeConnectionSettings({
                      ...connectionSettings,
                      externalBaseUrl: e.target.value,
                    })
                  }
                  placeholder="http://localhost:5000"
                  aria-label="URL server Flask esterno"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
