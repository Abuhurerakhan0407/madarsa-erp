import Link from "next/link";
import type { ReactNode } from "react";

export type WorkspaceAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  kind?: "primary" | "secondary";
};

type WorkspacePageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: WorkspaceAction[];
};

export function WorkspacePageHeader({ eyebrow, title, description, meta, actions = [] }: WorkspacePageHeaderProps) {
  return (
    <header className="workspace-page-header" data-page-section>
      <div className="workspace-page-copy">
        {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="workspace-description">{description}</p> : null}
      </div>
      <div className="workspace-page-side">
        {meta ? <div className="workspace-page-meta">{meta}</div> : null}
        {actions.length ? (
          <div className="workspace-actions" aria-label="Page actions">
            {actions.map((action) => {
              const className = action.kind === "primary" ? "action-button action-button-primary" : "action-button";
              if (action.href) return <Link className={className} href={action.href} key={action.label}>{action.label}</Link>;
              return <button className={className} key={action.label} onClick={action.onClick} type="button">{action.label}</button>;
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}

type TaskItem = {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
};

export function TaskLanding({ title, description, items }: { title?: string; description?: string; items: TaskItem[] }) {
  return (
    <section className="workspace-task-section" data-page-section>
      {title || description ? <header className="workspace-section-heading">{title ? <h2>{title}</h2> : null}{description ? <p>{description}</p> : null}</header> : null}
      <div className="workspace-task-list">
        {items.map((item) => (
          <Link className="workspace-task-row" href={item.href} key={`${item.href}-${item.title}`}>
            <div>
              {item.eyebrow ? <span>{item.eyebrow}</span> : null}
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
            <span className="workspace-task-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FilterBar({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="workspace-filter-bar" aria-label={label}>{children}</section>;
}

export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return <label className="workspace-field"><span>{label}</span>{children}</label>;
}

export function TableFrame({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="workspace-table-frame" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

type WorkspaceStateProps = {
  code?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger" | "success";
  role?: "status" | "alert";
};

export function WorkspaceState({ code, eyebrow, title, body, action, tone = "neutral", role = "status" }: WorkspaceStateProps) {
  return (
    <section className="workspace-state" data-tone={tone} role={role}>
      <div className="workspace-state-mark" aria-hidden="true">{code ?? "·"}</div>
      <div>
        {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {body ? <p>{body}</p> : null}
        {action ? <div className="workspace-state-action">{action}</div> : null}
      </div>
    </section>
  );
}

export function SuccessNotice({ title, body }: { title: string; body?: string }) {
  return <div className="workspace-success" role="status"><strong>{title}</strong>{body ? <span>{body}</span> : null}</div>;
}
