# Ilmgaah Biometric Client Installation Runbook

Status: Release-candidate installation procedure  
Scope: Physical mBio-compatible biometric attendance installation for an Ilmgaah client institution  
Safety rule: This runbook does not assume a vendor port, protocol variant, export column name, or mBio model value that has not been observed on the actual client device/software.

## 1. Acceptance definition

The biometric installation is accepted only when all of the following are proven on the client site:

1. The biometric terminal is reachable from the client attendance desktop over the institution LAN.
2. Vendor attendance software can read punches from the terminal.
3. Vendor software automatically writes a stable CSV or XLSX attendance export to a known local folder.
4. The Ilmgaah Windows Biometric Bridge starts automatically on Windows boot.
5. The bridge can read the export without collecting fingerprint templates, fingerprint/face images, or other raw biometric material.
6. The Ilmgaah device registration token is valid and stored only in the protected bridge installation folder.
7. Each required device user ID is mapped to the correct Ilmgaah student or staff record.
8. A mapped student punch becomes an Ilmgaah attendance record automatically without an operator pressing Apply.
9. A first student check-in/presence punch for the local day creates one guardian in-app arrival notification.
10. A second same-day punch does not create duplicate attendance or duplicate arrival notification.
11. An unmapped user remains retryable/mappable and does not create fabricated attendance.
12. An internet outage leaves punches queued locally and they are delivered after connectivity returns.
13. Restarting the Windows desktop does not break the bridge or lose queued punches.
14. The bridge health file reports a healthy/running state and queue depth returns to zero.
15. No production acceptance is signed until the institution administrator validates the displayed student, date, time, and attendance result.

## 2. Architecture

Biometric terminal
→ client LAN / TCP-IP
→ vendor attendance software
→ automatic CSV/XLSX export folder
→ Ilmgaah Windows Biometric Bridge
→ HTTPS POST /api/attendance/device-ingest
→ device-token authentication
→ device-user mapping
→ governed Ilmgaah attendance runtime
→ attendance record
→ guardian in-app arrival notification

Ilmgaah does not require or accept raw fingerprint templates or fingerprint/face images.

## 3. Before travelling to the client site

Prepare:

- biometric terminal and its power adapter
- client Windows desktop
- monitor/keyboard/mouse if not already installed
- router/switch access or the institution network administrator
- one Ethernet cable per wired biometric terminal being installed
- spare Ethernet cable for diagnosis
- vendor attendance software installer/license details, if required by vendor
- vendor device communication manual or verified settings screen
- Ilmgaah administrator account for the institution
- final deployed Ilmgaah URL
- Windows Biometric Bridge package generated from the approved release commit
- bridge package SHA-256 manifest
- secure method for transferring the one-time Ilmgaah device token
- at least two test users: one student and, if staff attendance is required, one staff member

Do not travel to the site assuming Wi-Fi support. A terminal that only exposes Ethernet must be connected to the LAN by Ethernet or through an appropriate network bridge supplied/configured for that site.

## 4. Institution configuration prerequisite

Before enabling biometric ingestion, the institution must have its initial Ilmgaah configuration completed.

At minimum:

- institution profile
- active branch
- active academic session covering the current date
- active program/enrollment for the test student
- published student number sequence
- configuration preset applied
- student attendance statuses configured

The release smoke test proved that a device punch correctly remains matched/retryable if student attendance status configuration is missing. Configure the institution first, then retry; do not bypass this guard.

For a typical madrasa, use the appropriate Ilmgaah preset (for example Maktab or Hifz Academy) rather than creating arbitrary attendance statuses.

## 5. Network installation

### 5.1 Connect the terminal

Preferred production setup:

- biometric terminal → Ethernet → institution router/switch
- client attendance desktop → same LAN, Ethernet or stable Wi-Fi

Do not expose the biometric terminal directly to the public internet.

### 5.2 Assign a stable address

Use either:

- DHCP reservation on the router, preferred when router access is available, or
- a static IPv4 address outside the DHCP conflict range.

Record:

- terminal IP address
- subnet mask
- gateway
- DNS if the terminal requires it
- vendor communication port shown by the actual terminal/software
- terminal/device ID if used by the vendor application

Never invent a port number from another mBio model. Use the value shown by the actual device/vendor software.

### 5.3 Verify LAN reachability

From the client desktop:

- confirm the desktop is on the expected LAN
- ping the terminal if the device responds to ICMP
- use the vendor application's device-connect/test function
- confirm the vendor application reports the real device online

A failed ping alone does not prove the device is unavailable because some terminals do not reply to ICMP. The vendor application connection test is the decisive check.

## 6. Vendor attendance software

Install the vendor software only from the vendor-provided or otherwise verified source.

Configure the real terminal using its verified:

- IP address
- communication port
- device ID
- password/communication key, if applicable

Then:

1. synchronize the terminal clock/timezone if the vendor software supports it
2. fetch device users/logs
3. create a test punch
4. verify the punch appears in vendor software with the correct device user ID and time

## 7. Automatic export

Configure vendor software to automatically write attendance records to a dedicated folder such as:

C:\Ilmgaah\BiometricExport

Preferred formats:

1. CSV
2. XLSX

Legacy XLS is not accepted by the current bridge. If the vendor can only automate XLS, the rollout is blocked until a verified conversion adapter is added and tested.

Record the exact real export headings. Examples might represent:

- device user ID
- punch date/time, or separate date and time
- IN/OUT state
- verification mode
- device name

Do not assume these exact names. Configure the bridge using the headings found in the actual export.

Never configure fingerprint/template/image columns as bridge metadata.

## 8. Register the device in Ilmgaah

In Ilmgaah Attendance → Devices:

1. create a biometric device for the correct institution and branch
2. enter a stable external device key
3. label the physical location, e.g. Main Gate
4. record vendor/model only when confirmed
5. create the device
6. copy the one-time ingest token securely

The token must not be placed in chat logs, screenshots, shared spreadsheets, public repositories, or the vendor export folder.

If the token is exposed, rotate it in Ilmgaah and replace the bridge configuration immediately.

## 9. Map device users

For each person who should generate attendance:

- read the exact device user ID from the vendor/device
- map it to the correct Ilmgaah student or staff record
- verify the branch
- verify the subject type

Do not infer the person from a name alone.

For initial acceptance, map only the known test users first.

## 10. Configure the Windows Bridge

Use the package produced by the approved release commit.

Create a client configuration from config.example.json with:

- baseUrl
- externalDeviceKey
- ingestToken
- watchFolder
- CSV/XLSX extension
- sheet name if XLSX requires it
- header row
- subject/user-ID column
- timestamp column, or date + time columns
- source timezone offset
- punch-state column and mapping if applicable
- only non-sensitive metadata columns

For India timestamps without an explicit timezone, use +05:30.

Validate the configuration before installation.

## 11. Install the Windows Bridge

Open PowerShell as Administrator from the extracted approved bridge package:

.\install.ps1 -ConfigPath "C:\path\to\client-config.json"

The installer is expected to:

- validate the configuration
- copy the bridge into its protected ProgramData location
- protect configuration/token access to SYSTEM and local Administrators
- create the automatic SYSTEM scheduled task
- start the bridge
- require no inbound Windows Firewall rule

Check:

.\status.ps1

Verify:

- task exists and is running/ready
- health file is current
- queue count is zero before the test punch
- logs show no configuration error

## 12. On-site acceptance test

### Test A — mapped student arrival

1. Confirm bridge queue = 0.
2. Student uses biometric terminal.
3. Confirm vendor software receives the punch.
4. Confirm CSV/XLSX updates automatically.
5. Confirm bridge discovers the row.
6. Confirm bridge queue returns to 0.
7. Confirm Ilmgaah device event state = applied.
8. Confirm student attendance = present with source biometric.
9. Confirm correct local date/time.
10. Confirm verified guardian receives one Ilmgaah in-app arrival notification.

### Test B — duplicate/same-day punch

Punch the same student again.

Expected:

- device event may be recorded/applied
- no duplicate daily attendance record
- no second same-day guardian arrival notification

### Test C — unmapped ID

Use an unmapped test device user ID if safe.

Expected:

- event remains received/matched as designed
- no fabricated student attendance
- after mapping is corrected, the event can be retried/applied

### Test D — internet outage

1. Disconnect internet while leaving LAN/device communication operational.
2. Create a test punch.
3. Confirm vendor export receives it.
4. Confirm bridge queue increases.
5. Reconnect internet.
6. Confirm queued event is delivered.
7. Confirm queue returns to zero.
8. Confirm only one attendance result is created.

### Test E — desktop restart

1. Ensure queue = 0.
2. Restart Windows.
3. Do not manually launch developer tools.
4. Confirm bridge scheduled task starts automatically.
5. Create another authorized test punch.
6. Confirm full flow works.

## 13. Failure rules

### Device offline in vendor software

Check, in order:

- power
- Ethernet/link lights
- LAN connection
- terminal IP/subnet/gateway
- IP conflict
- verified vendor port/key
- vendor device configuration

Do not troubleshoot the Ilmgaah bridge until vendor software itself can communicate with the terminal.

### Export not updating

The blocker is vendor software/export automation.

Verify:

- correct export schedule
- correct output folder
- Windows filesystem permissions
- file format
- whether vendor software requires an explicit auto-export/sync setting

### Bridge queue growing

Check:

- internet/DNS
- deployed Ilmgaah URL
- device token validity
- external device key
- server response in structured log
- student/staff mapping
- institution attendance configuration

Do not delete the queue to make an error disappear.

### 401 / device authentication failed

Rotate the Ilmgaah device token and update protected bridge configuration.

### Event matched but retryable

Check the reported error. Common release-proven example:

student attendance status configuration is missing

Correct the institution configuration and retry. The punch must remain recoverable.

### 400 / quarantined event

Treat it as invalid input/configuration. Inspect non-sensitive error details and vendor row structure.

Never weaken the server's raw-biometric rejection to make an export pass.

## 14. Security requirements

- no raw biometric templates/images in Ilmgaah
- no biometric terminal directly exposed to the public internet
- outbound HTTPS from bridge only
- device token unique per registered device
- rotate exposed tokens
- protected ProgramData config
- no token in source control
- no token in vendor CSV/XLSX
- do not run the bridge from a shared Downloads folder in production
- Windows account used for ordinary madrasa work should not need access to the stored token
- keep Windows updates/antivirus enabled
- use stable clock/timezone settings on terminal, desktop, and institution profile

## 15. Handover evidence

Before leaving the site, record without secrets:

- institution
- branch
- physical device label
- terminal model/serial if available
- terminal LAN IP
- vendor communication software/version
- export format
- export folder
- exact non-sensitive column mapping
- bridge version
- package SHA-256
- installation date
- test student ID/name approved for test
- timestamps/results of Tests A-E
- administrator who accepted the result
- unresolved exceptions

Do not record the ingest token.

## 16. Rollback / disable

If biometric ingestion must be stopped:

1. stop/disable the bridge scheduled task
2. leave vendor export intact for evidence unless instructed otherwise
3. rotate/revoke the Ilmgaah device token if compromise is suspected
4. use Ilmgaah governed attendance correction for any incorrect applied records
5. do not manually edit historical attendance rows in the database

Use uninstall.ps1 only when the installation should be removed, not as a routine troubleshooting step.

## 17. Production sign-off

Biometric is production-ready for the specific client only after:

- Tests A-E pass where applicable
- all real device users required for go-live are mapped
- guardian notification behavior is confirmed with the client
- client administrator has been trained on device health, mappings, queue/status, and escalation
- a support contact and failure procedure are agreed
- the software release itself has passed the final Ilmgaah production gate
