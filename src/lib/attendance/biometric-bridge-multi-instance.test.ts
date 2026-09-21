import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "tools/biometric-bridge");
const read = (name: string) => readFileSync(resolve(root, name), "utf8");

describe("biometric bridge multi-instance installer contract", () => {
  const install = read("install.ps1");
  const status = read("status.ps1");
  const uninstall = read("uninstall.ps1");
  const docs = read("README.md");

  it("keeps backward-compatible default installation paths and task name", () => {
    expect(install).toContain('[string]$InstanceName = "default"');
    expect(install).toContain('"Ilmgaah Biometric Bridge"');
    expect(install).toContain('$env:ProgramData\\Ilmgaah\\BiometricBridge');
  });

  it("isolates named terminals by task name and ProgramData root", () => {
    for (const script of [install, status, uninstall]) {
      expect(script).toContain('$SafeInstanceName');
      expect(script).toContain('"Ilmgaah Biometric Bridge - $SafeInstanceName"');
      expect(script).toContain('$env:ProgramData\\Ilmgaah\\BiometricBridge\\$SafeInstanceName');
    }
  });

  it("sanitizes and bounds the instance name before using it in paths/tasks", () => {
    for (const script of [install, status, uninstall]) {
      expect(script).toContain("-replace '[^A-Za-z0-9._-]', '-'");
      expect(script).toContain('if ($SafeInstanceName.Length -gt 48)');
      expect(script).toContain('if ([string]::IsNullOrWhiteSpace($InstanceName))');
    }
  });

  it("documents the four-terminal rollout rule and forbids ambiguous combined exports", () => {
    for (const name of ["BIO-01", "BIO-02", "BIO-03", "BIO-04"]) {
      expect(docs).toContain('-InstanceName "' + name + '"');
    }
    expect(docs).toContain("distinct export source for each terminal");
    expect(docs).toContain("Do not point several instances at the same combined export");
  });
});
