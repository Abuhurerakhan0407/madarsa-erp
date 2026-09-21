import type { MobileWorkspace } from './lib/mobile-api';

export default function ModuleGatePanel({ workspace, moduleLabel }: { workspace: MobileWorkspace; moduleLabel: string }) {
  const isFees = moduleLabel.toLowerCase().includes('fee');
  return (
    <section className="native-module-gate" aria-label={`${moduleLabel} native release status`}>
      <div className="gate-mark" aria-hidden="true">↗</div>
      <span className="section-kicker">Native release gate</span>
      <h2>{moduleLabel} is intentionally locked.</h2>
      <p>
        {isFees
          ? 'Fee data will only open after a guardian/staff scoped billing contract is verified. We are not exposing financial records through a guessed query.'
          : `The ${moduleLabel} native surface is still being connected to a verified ${workspace.surface} authorization boundary.`}
      </p>
      <div className="gate-safety-row">
        <span>Read/write boundary</span><strong>Protected</strong>
        <span>Workspace</span><strong>{workspace.surface} · {workspace.accessMode}</strong>
      </div>
      <p className="read-only-note">The live-web Dev APK remains available for ERP functionality while this native module is completed.</p>
    </section>
  );
}
