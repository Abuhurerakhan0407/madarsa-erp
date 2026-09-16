import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { modulesBySurface } from './app-model';
import { getMobileBootstrap, type MobileBootstrap, type MobileWorkspace } from './lib/mobile-api';
import { clearSecureSessionStorage } from './lib/secure-session-storage';
import { mobileAuthConfigured, supabase } from './lib/supabase';

function feedback(style: ImpactStyle = ImpactStyle.Light) {
  void Haptics.impact({ style }).catch(() => undefined);
}

function workspaceLabel(workspace: MobileWorkspace) {
  return workspace.branchName ? `${workspace.tenantName} · ${workspace.branchName}` : workspace.tenantName;
}

function moduleFromAppUrl(value: string) {
  try {
    const url = new URL(value);
    const isNativeScheme = url.protocol === 'ilmgaah:';
    const isTrustedWebLink = url.protocol === 'https:' && (url.hostname === 'ilmgaah.in' || url.hostname === 'www.ilmgaah.in');
    if (!isNativeScheme && !isTrustedWebLink) return null;

    if (isNativeScheme && url.hostname) return url.hostname.toLowerCase();
    const requested = url.searchParams.get('module')?.trim().toLowerCase();
    if (requested) return requested;

    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'home';
    if ((parts[0] === 'app' || parts[0] === 'mobile') && parts[1]) return parts[1].toLowerCase();
    return parts[0].toLowerCase();
  } catch {
    return null;
  }
}

export default function App() {
  const [online, setOnline] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(mobileAuthConfigured);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [workspace, setWorkspace] = useState<MobileWorkspace | null>(null);
  const [activeModule, setActiveModule] = useState('home');
  const [pendingModule, setPendingModule] = useState<string | null>(null);

  const modules = useMemo(() => (workspace ? modulesBySurface[workspace.surface] : []), [workspace]);
  const selectedModule = modules.find((item) => item.id === activeModule) ?? modules[0];

  useEffect(() => {
    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: '#0F3329' }).catch(() => undefined);
    void SplashScreen.hide().catch(() => undefined);

    void Network.getStatus().then((status) => setOnline(status.connected));
    const networkListener = Network.addListener('networkStatusChange', (status) => {
      setOnline(status.connected);
      if (status.connected) setError((current) => (current === 'You are offline.' ? null : current));
    });

    const urlListener = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const requestedModule = moduleFromAppUrl(url);
      if (requestedModule) setPendingModule(requestedModule);
    });

    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (!launch?.url) return;
      const requestedModule = moduleFromAppUrl(launch.url);
      if (requestedModule) setPendingModule(requestedModule);
    }).catch(() => undefined);

    return () => {
      void networkListener.then((handle) => handle.remove());
      void urlListener.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!supabase) {
        setRestoring(false);
        return;
      }

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) return;

        const nextBootstrap = await getMobileBootstrap(data.session.access_token);
        if (!nextBootstrap.workspaces.length) {
          await supabase.auth.signOut();
          await clearSecureSessionStorage();
          return;
        }

        if (cancelled) return;
        setBootstrap(nextBootstrap);
        setWorkspace(nextBootstrap.workspaces[0]);
        setActiveModule('home');
      } catch {
        if (!cancelled) setError('Your saved session could not be restored. Sign in again.');
        await supabase.auth.signOut().catch(() => undefined);
        await clearSecureSessionStorage().catch(() => undefined);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingModule || !workspace) return;
    if (modules.some((module) => module.id === pendingModule)) {
      setActiveModule(pendingModule);
      feedback();
    }
    setPendingModule(null);
  }, [modules, pendingModule, workspace]);

  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (workspace && activeModule !== 'home') {
        setActiveModule('home');
        feedback();
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      void CapacitorApp.minimizeApp().catch(() => undefined);
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [activeModule, workspace]);

  useEffect(() => {
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      void Network.getStatus().then(async (status) => {
        setOnline(status.connected);
        if (!status.connected || !workspace || !supabase) return;

        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !data.session) {
          setBootstrap(null);
          setWorkspace(null);
          setActiveModule('home');
          setError('Your session expired. Sign in again.');
          await clearSecureSessionStorage().catch(() => undefined);
        }
      }).catch(() => undefined);
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [workspace]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      setBootstrap(null);
      setWorkspace(null);
      setActiveModule('home');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    if (!online) {
      setError('You are offline.');
      return;
    }
    if (!mobileAuthConfigured || !supabase) {
      setError('Production mobile authentication is not configured yet.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !data.session?.access_token) {
        throw new Error('Email or password is incorrect.');
      }

      const nextBootstrap = await getMobileBootstrap(data.session.access_token);
      if (!nextBootstrap.workspaces.length) {
        await supabase.auth.signOut();
        await clearSecureSessionStorage();
        throw new Error('No mobile workspace is assigned to this account.');
      }

      setBootstrap(nextBootstrap);
      setWorkspace(nextBootstrap.workspaces[0]);
      setActiveModule('home');
      setPassword('');
      feedback(ImpactStyle.Medium);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  }, [email, online, password]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await supabase?.auth.signOut();
      await clearSecureSessionStorage();
    } finally {
      setBootstrap(null);
      setWorkspace(null);
      setActiveModule('home');
      setPassword('');
      setBusy(false);
      feedback();
    }
  }, []);

  if (restoring) {
    return (
      <main className="app-shell auth-shell restore-shell" aria-live="polite">
        <section className="auth-hero restore-card">
          <div className="brand-row" aria-label="Ilmgaah">
            <img src="/ilmgaah-mark.svg" className="brand-logo" alt="" />
            <span>Ilmgaah</span>
          </div>
          <p className="eyebrow">Secure session</p>
          <h1>Opening your workspace.</h1>
          <p className="lead">Verifying your saved session and access scope.</p>
          <div className="restore-progress" aria-hidden="true"><span /></div>
        </section>
      </main>
    );
  }

  if (!bootstrap || !workspace) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-hero">
          <div className="brand-row" aria-label="Ilmgaah">
            <img src="/ilmgaah-mark.svg" className="brand-logo" alt="" />
            <span>Ilmgaah</span>
          </div>
          <p className="eyebrow">Institution operating system</p>
          <h1>Everything important, in one calm place.</h1>
          <p className="lead">A focused mobile workspace for administrators, teachers and families.</p>
        </section>

        <section className="auth-card" aria-label="Sign in to Ilmgaah">
          <div className="connection-line">
            <span className={`connection-dot ${online ? 'is-online' : 'is-offline'}`} />
            {online ? 'Connected securely' : 'Offline'}
          </div>

          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@institution.org"
              disabled={busy}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void signIn();
              }}
              placeholder="Your password"
              disabled={busy}
            />
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="primary-button" type="button" onClick={() => void signIn()} disabled={busy}>
            {busy ? 'Opening workspace…' : 'Sign in'}
          </button>

          <p className="privacy-note">On Android, your session is encrypted with a device KeyStore-backed key. Browser previews keep sessions in memory only.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      {!online ? <div className="offline-banner">Offline · reconnect to refresh data</div> : null}

      <header className="mobile-header">
        <div className="brand-row compact" aria-label="Ilmgaah">
          <img src="/ilmgaah-mark.svg" className="brand-logo" alt="" />
          <span>Ilmgaah</span>
        </div>
        <button className="ghost-button" type="button" onClick={() => void signOut()} disabled={busy}>Sign out</button>
      </header>

      <section className="workspace-intro">
        <p className="eyebrow">{workspace.surface}</p>
        <h1>{selectedModule?.label ?? 'Home'}</h1>
        <p>{selectedModule?.description ?? 'Your Ilmgaah workspace.'}</p>
      </section>

      {bootstrap.workspaces.length > 1 ? (
        <label className="workspace-switcher">
          <span>Workspace</span>
          <select
            value={`${workspace.tenantId}:${workspace.branchId ?? 'all'}:${workspace.surface}`}
            onChange={(event) => {
              const next = bootstrap.workspaces.find(
                (item) => `${item.tenantId}:${item.branchId ?? 'all'}:${item.surface}` === event.target.value,
              );
              if (next) {
                setWorkspace(next);
                setActiveModule('home');
                feedback();
              }
            }}
          >
            {bootstrap.workspaces.map((item) => (
              <option key={`${item.tenantId}:${item.branchId ?? 'all'}:${item.surface}`} value={`${item.tenantId}:${item.branchId ?? 'all'}:${item.surface}`}>
                {workspaceLabel(item)} · {item.surface}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="institution-card">
          <span>Workspace</span>
          <strong>{workspaceLabel(workspace)}</strong>
        </div>
      )}

      <section className="module-grid" aria-label={`${workspace.surface} modules`}>
        {modules.map((module, index) => (
          <button
            key={module.id}
            type="button"
            className={`module-card ${activeModule === module.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveModule(module.id);
              feedback();
            }}
          >
            <span className="module-index">{String(index + 1).padStart(2, '0')}</span>
            <strong>{module.shortLabel}</strong>
            <span>{module.description}</span>
          </button>
        ))}
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {modules.slice(0, 4).map((module) => (
          <button
            key={module.id}
            type="button"
            className={activeModule === module.id ? 'is-active' : ''}
            onClick={() => {
              setActiveModule(module.id);
              feedback();
            }}
          >
            {module.shortLabel}
          </button>
        ))}
      </nav>
    </main>
  );
}
