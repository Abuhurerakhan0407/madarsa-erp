import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("operator backup script", () => {
  it("fails closed when MADARSA_ERP_DATABASE_URL is missing", () => {
    try {
      execFileSync("bash", ["scripts/operator-backup.sh"], {
        env: {
          ...process.env,
          MADARSA_ERP_DATABASE_URL: "",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "this-is-a-valid-passphrase-24-chars-long"
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Missing required environment variable MADARSA_ERP_DATABASE_URL");
      expect(stderr).not.toContain("this-is-a-valid-passphrase-24-chars-long");
    }
  });

  it("fails closed when MADARSA_ERP_RECOVERY_PASSPHRASE is missing", () => {
    try {
      execFileSync("bash", ["scripts/operator-backup.sh"], {
        env: {
          ...process.env,
          MADARSA_ERP_DATABASE_URL: "postgresql://postgres:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres",
          MADARSA_ERP_RECOVERY_PASSPHRASE: ""
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Missing required environment variable MADARSA_ERP_RECOVERY_PASSPHRASE");
      expect(stderr).not.toContain("postgres:secret");
    }
  });

  it("fails closed when recovery passphrase is too short", () => {
    try {
      execFileSync("bash", ["scripts/operator-backup.sh"], {
        env: {
          ...process.env,
          MADARSA_ERP_DATABASE_URL: "postgresql://postgres:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "short"
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Recovery passphrase must be at least 24 characters");
      expect(stderr).not.toContain("short");
      expect(stderr).not.toContain("postgres:secret");
    }
  });

  it("fails closed when DB URL does not contain project ref", () => {
    try {
      execFileSync("bash", ["scripts/operator-backup.sh"], {
        env: {
          ...process.env,
          MADARSA_ERP_DATABASE_URL: "postgresql://postgres:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "this-is-a-valid-passphrase-24-chars-long"
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Database URL does not point to the Madarsa ERP Supabase project.");
      expect(stderr).not.toContain("this-is-a-valid-passphrase-24-chars-long");
      expect(stderr).not.toContain("postgres:secret");
    }
  });
});

describe("operator restore drill script", () => {
  it("fails closed when RESTORE_DB_URL is missing", () => {
    try {
      execFileSync("bash", ["scripts/operator-restore-drill.sh"], {
        env: {
          ...process.env,
          RESTORE_DB_URL: "",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "this-is-a-valid-passphrase-24-chars-long",
          ENCRYPTED_BACKUP_PATH: "/dev/null"
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Missing required environment variable RESTORE_DB_URL");
    }
  });

  it("fails closed when ENCRYPTED_BACKUP_PATH is missing", () => {
    try {
      execFileSync("bash", ["scripts/operator-restore-drill.sh"], {
        env: {
          ...process.env,
          RESTORE_DB_URL: "postgresql://postgres:secret@127.0.0.1:5432/postgres",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "this-is-a-valid-passphrase-24-chars-long",
          ENCRYPTED_BACKUP_PATH: ""
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Missing required environment variable ENCRYPTED_BACKUP_PATH");
    }
  });

  it("fails closed when RESTORE_DB_URL is not isolated", () => {
    try {
      execFileSync("bash", ["scripts/operator-restore-drill.sh"], {
        env: {
          ...process.env,
          RESTORE_DB_URL: "postgresql://postgres:secret@dysfnytqpbfxpmerkyaz.supabase.co:5432/postgres",
          MADARSA_ERP_RECOVERY_PASSPHRASE: "this-is-a-valid-passphrase-24-chars-long",
          ENCRYPTED_BACKUP_PATH: "/dev/null"
        },
        stdio: "pipe"
      });
      expect.unreachable("Script should have failed");
    } catch (error) {
      const execError = error as { status: number; stderr: Buffer };
      expect(execError.status).toBe(1);
      const stderr = execError.stderr.toString();
      expect(stderr).toContain("Restore target must be local/isolated");
      expect(stderr).not.toContain("postgres:secret");
    }
  });
});
