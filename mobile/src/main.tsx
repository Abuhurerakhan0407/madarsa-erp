import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import './styles.css';

function App() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: '#0F5F46' }).catch(() => undefined);
    void SplashScreen.hide().catch(() => undefined);

    void Network.getStatus().then((status) => setOnline(status.connected));
    const listener = Network.addListener('networkStatusChange', (status) => setOnline(status.connected));
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  return (
    <main className="shell">
      <section className="brand-card" aria-label="Ilmgaah mobile shell">
        <div className="mark" aria-hidden="true">ع</div>
        <p className="eyebrow">ILMGAAH</p>
        <h1>Institution operations, beautifully unified.</h1>
        <p className="copy">
          {online
            ? 'Secure mobile workspace ready.'
            : 'You are offline. Reconnect to continue securely.'}
        </p>
        <span className={`status ${online ? 'online' : 'offline'}`}>
          {online ? 'Connected' : 'Offline'}
        </span>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
