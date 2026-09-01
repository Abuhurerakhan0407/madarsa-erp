# Operator manual recovery guide

This document provides instructions for human operators to execute manual database backups and isolated recovery drills for Madarsa ERP without committing secrets and without modifying launch gates.

These tools complement the automated GitHub Actions workflow (`docs/recovery-drill.md`), allowing authorized operators to secure backups explicitly or test recovery locally while the Supabase organization is on the Free plan.

## Manual Backup Flow

The `scripts/operator-backup.sh` tool connects to the production database, produces a Supabase logical dump, encrypts the output, and prepares it for secure cold storage.

### Prerequisites

1.  Obtain the **Session pooler** connection string for the Supabase project `dysfnytqpbfxpmerkyaz`.
    *   **Never print this DB secret to logs or paste it in chat/issues.**
2.  Obtain the unique random recovery passphrase (must be at least 24 characters).
3.  Ensure the Supabase CLI is installed (`supabase --version`).

### Running the backup

```bash
export MADARSA_ERP_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
export MADARSA_ERP_RECOVERY_PASSPHRASE="your-24-character-recovery-passphrase"

./scripts/operator-backup.sh
```

### Post-backup tasks

1.  The script will generate an encrypted archive (e.g., `operator-backup-output/database-backup.tar.gz.enc`).
2.  Upload this encrypted archive to the authorized secure cold storage location.
3.  If this is an official backup run, manually record a row in the production `backup_evidence` table with `state = 'completed'`, referencing the cold storage location.
4.  **Non-negotiable:** Do not fabricate evidence in the `backup_evidence` table.

## Manual Restore Drill Flow

The `scripts/operator-restore-drill.sh` tool connects to a local, isolated non-production target database, decrypts an encrypted backup archive, restores it, and verifies basic integrity counts.

### Prerequisites

1.  A local PostgreSQL target database must be running (e.g., via Docker `supabase/postgres:17`).
2.  The `MADARSA_ERP_RECOVERY_PASSPHRASE` used during the backup.
3.  The path to the `.tar.gz.enc` file.

### Running the restore drill

```bash
export RESTORE_DB_URL="postgresql://postgres:password@127.0.0.1:5432/postgres"
export MADARSA_ERP_RECOVERY_PASSPHRASE="your-24-character-recovery-passphrase"
export ENCRYPTED_BACKUP_PATH="./operator-backup-output/database-backup.tar.gz.enc"

./scripts/operator-restore-drill.sh
```

### Post-drill tasks

1.  The script will verify row counts and output a JSON evidence bundle (e.g., `operator-restore-output/restore-evidence.json`).
2.  If this is an official restore drill, manually record a row in the production `restore_drills` table with `state = 'passed'`.
3.  Ensure the `backup_restore_drill_passed` launch gate in `config/launch-readiness.json` **remains false** until the full recovery scope (including Storage and application layers) is comprehensively verified.
4.  **Non-negotiable:** Do not fabricate evidence, restore success, or recovery time in the production database.
