# Ilmgaah Biometric Bridge (Windows)

Purpose: connect a biometric vendor's automatic attendance export to Ilmgaah without sending raw fingerprint/face material.

## Supported input
- CSV
- XLSX
- A configurable header row, worksheet, user-ID column, timestamp/date+time columns and punch-state mapping.

Legacy XLS is intentionally not parsed. Configure the vendor software to export CSV or XLSX. If the selected mBio software can only automate XLS, add a verified conversion adapter before client rollout.

## Security
- No inbound listener or firewall port.
- Outbound HTTPS only to `/api/attendance/device-ingest`.
- Device token is stored in the protected ProgramData installation folder.
- Installer restricts the folder to SYSTEM and local Administrators.
- Raw fingerprint templates, fingerprint/face images, photo/template/biometric metadata columns are rejected.
- Queue files contain only normalized device user ID, punch timestamp/type and allowed metadata.
- Ilmgaah server remains the authority for device token validation, user mapping, attendance permissions and idempotency.

## Reliability
- Polls the export directory instead of relying on fragile filesystem-watch events.
- Waits for files to settle before parsing.
- Deterministic event IDs prevent duplicate attendance.
- Offline/network failures stay in a persistent queue with exponential backoff.
- Unmapped or retryable server events stay queued and can apply after configuration is corrected.
- Invalid payloads are quarantined.
- Health is written to `data\health.json`; structured logs to `data\logs\bridge.jsonl`.

## Build
From the Ilmgaah repository with Node 22 and pnpm 11.19.0:

```powershell
pnpm biometric:bridge:build
```

The portable package is produced in `tools\biometric-bridge\dist` and contains its own Node runtime.

## Configuration
Copy `config.example.json` and set:
- `baseUrl`: deployed Ilmgaah URL.
- `externalDeviceKey`: must match the device registered in Ilmgaah.
- `ingestToken`: one-time token shown when the device is registered/rotated.
- `watchFolder`: vendor software's automatic export folder.
- Column names exactly as they appear in the vendor CSV/XLSX.
- `timezoneOffset`: timezone represented by timestamps that have no timezone (India: `+05:30`).

Do not put fingerprint/template/image columns in `metadataColumns`.

## Install on the client desktop
Open PowerShell as Administrator from the extracted bridge package:

```powershell
.\install.ps1 -ConfigPath "C:\path\to\client-config.json"
```

The installer validates the config, locks filesystem permissions, installs a SYSTEM scheduled task and starts it.

Check it with:

```powershell
.\status.ps1
```

Remove it with:

```powershell
.\uninstall.ps1
```

## Client-site acceptance test
1. Device and client desktop are on the same LAN.
2. Vendor attendance software can communicate with the mBio over TCP/IP.
3. Vendor software automatically creates/updates a CSV or XLSX export.
4. Register the biometric device in Ilmgaah and copy its token.
5. Map the mBio user ID to the correct Ilmgaah student/staff member.
6. Install this bridge with the exact export columns.
7. Punch once.
8. Confirm the bridge queue reaches zero.
9. Confirm the Ilmgaah device event becomes `applied`.
10. Confirm student/staff attendance appears at the correct local time/date.
11. For a student check-in/presence, confirm the verified guardian receives one Ilmgaah in-app arrival notification for that day.
12. Disconnect internet, punch again, reconnect, and verify queued delivery succeeds.
13. Repeat after restarting the client desktop.

Do not mark biometric installation accepted until all applicable checks pass.
