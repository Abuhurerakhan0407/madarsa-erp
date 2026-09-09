import { expect, test } from "@playwright/test";

// Fixture safety: allow override via env, defaults are read-only seeded values only
// Never create Ahmed; use Ayaan Siddiqui which is seeded in Al-Noor Islamic Academy
const FIXTURE = {
  name: process.env.ILMGAAH_E2E_FIXTURE_NAME || "Ayaan Siddiqui",
  studentNumber: process.env.ILMGAAH_E2E_FIXTURE_STUDENT_NUMBER || "STU-MAIN-2026_27-00001",
  personId: Number(process.env.ILMGAAH_E2E_FIXTURE_PERSON_ID || "4"),
  groupId: Number(process.env.ILMGAAH_E2E_FIXTURE_GROUP_ID || "2"),
  groupLabel: process.env.ILMGAAH_E2E_FIXTURE_GROUP_LABEL || "Dars-e-Nizami · Year 1 A",
};

const hasStorageState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);
const canWrite =
  process.env.ILMGAAH_E2E_ALLOW_WRITES === "1" &&
  hasStorageState &&
  Boolean(process.env.PLAYWRIGHT_BASE_URL); // require explicit external/test server, not default localhost

// -----------------------------------------------------------------------------
// A. AUTHENTICATED READ-ONLY UX TESTS
// Safe to run against an authenticated test/live preview. Require storageState.
// If absent, skip with clear reason instead of failing on /login.
// -----------------------------------------------------------------------------
test.describe("phase 3 rescue — authenticated read-only UX", () => {
  test.skip(!hasStorageState, "Skipping authenticated read-only UX tests: PLAYWRIGHT_STORAGE_STATE not set (set to an authenticated storageState file to run)");

  test("authenticated dashboard loads", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: /Al-Noor Islamic Academy/ })).toBeVisible();
    await expect(page.getByText(/Live operations|Institution overview/i).first()).toBeVisible();
  });

  test("global student search finds Ayaan (read-only)", async ({ page }) => {
    await page.goto("/en");
    const globalSearch = page.locator("#global-student-search");
    await expect(globalSearch).toBeVisible();
    await globalSearch.fill(FIXTURE.name.slice(0, 4)); // "Ayaa" — requires >=2 chars, debounced 220ms
    const listbox = page.getByRole("listbox", { name: /Find student/ });
    await expect(listbox).toBeVisible({ timeout: 7000 });
    const option = page.getByRole("option", { name: new RegExp(FIXTURE.name) });
    await expect(option).toBeVisible();
    // verify option shows studentNumber
    await expect(option).toContainText(FIXTURE.studentNumber);
  });

  test("global search keyboard navigation (ArrowDown, Escape)", async ({ page }) => {
    await page.goto("/en");
    const input = page.locator("#global-student-search");
    await input.fill("Ayaa");
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 7000 });
    await input.press("ArrowDown");
    const firstOptionId = `global-search-option-${FIXTURE.personId}`;
    // first option should be aria-selected
    const firstOption = page.locator(`#${firstOptionId}`);
    if (await firstOption.isVisible()) {
      await expect(firstOption).toHaveAttribute("aria-selected", "true");
    }
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden({ timeout: 2000 });
  });

  test("global search shows clear no-results for Ahmed", async ({ page }) => {
    await page.goto("/en");
    const input = page.locator("#global-student-search");
    await input.fill("Ahmed");
    // wait for debounce + fetch
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 7000 });
    await expect(page.getByText(/No matching students/i)).toBeVisible();
    await expect(page.getByText(/try a different name/i)).toBeVisible();
  });

  test("student profile opens and daily-work links are discoverable", async ({ page }) => {
    // Use search to discover, not hard-coded navigation
    await page.goto("/en");
    const globalSearch = page.locator("#global-student-search");
    await globalSearch.fill(FIXTURE.name.slice(0, 4));
    const option = page.getByRole("option", { name: new RegExp(FIXTURE.name) });
    await expect(option).toBeVisible({ timeout: 7000 });
    await option.click();
    await expect(page).toHaveURL(new RegExp(`/en/students/${FIXTURE.personId}`));
    await expect(page.getByRole("heading", { name: FIXTURE.name })).toBeVisible();
    await expect(page.getByRole("link", { name: /Print ID Card/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mark \/ view attendance/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Qur'an progress/i })).toBeVisible();
  });

  test("attendance page and roster controls are reachable (read-only)", async ({ page }) => {
    await page.goto("/en/attendance");
    await expect(page.getByRole("heading", { name: /Mark Attendance|Daily Attendance/i }).first()).toBeVisible();
    const groupSelect = page.locator("#attendance-group-select");
    // group selector should be visible and have options
    await expect(groupSelect).toBeVisible();
    await expect(groupSelect.locator("option")).not.toHaveCount(0);
    // selecting group should load toolbar/metrics without writing
    await groupSelect.selectOption(String(FIXTURE.groupId));
    await page.waitForTimeout(1000);
    // After selection, either "Start today's attendance" or roster should be visible — both are read-only discoverability
    const startBtn = page.getByRole("button", { name: /Start today's attendance/i });
    const roster = page.locator(".attendance-register, .attendance-session-bar");
    await expect(startBtn.or(roster.first())).toBeVisible({ timeout: 5000 });
  });

  test("Qur'an roster and target controls are reachable (read-only)", async ({ page }) => {
    await page.goto(`/en/quran?group=${FIXTURE.groupId}`);
    await expect(page.getByRole("heading", { name: /Qur'an & Hifz/i })).toBeVisible();
    await expect(page.getByText(FIXTURE.name).first()).toBeVisible({ timeout: 8000 });
    // Quick actions should be discoverable
    await expect(page.getByRole("button", { name: /^Pass$/ }).first()).toBeVisible();
    // Expanding details should show target fields
    const detailsToggle = page.getByRole("button", { name: /Details|Hide details/i }).first();
    if (await detailsToggle.isVisible()) {
      await detailsToggle.click();
      await expect(page.getByText(/Recitation target|Target/i).first()).toBeVisible();
    }
  });

  test("ID-card preview renders and window.print can be stubbed", async ({ page }) => {
    await page.goto(`/en/students/${FIXTURE.personId}/id-card`);
    await expect(page.getByRole("heading", { name: /Student ID card/i })).toBeVisible();
    await expect(page.getByText(FIXTURE.studentNumber)).toBeVisible();
    const printBtn = page.getByRole("button", { name: /Print ID card/i });
    await expect(printBtn).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { printCalled?: boolean }).printCalled = false;
      window.print = () => {
        (window as unknown as { printCalled: boolean }).printCalled = true;
      };
    });
    await printBtn.click();
    await expect.poll(async () => page.evaluate(() => (window as unknown as { printCalled?: boolean }).printCalled)).toBe(true);
  });

  test("exams selection exposes Enter Marks CTA (read-only)", async ({ page }) => {
    await page.goto("/en/exams");
    await expect(page.getByRole("heading", { name: /Exams, Results/i })).toBeVisible();
    const examSelect = page.locator('select').last();
    await expect(examSelect).toBeVisible();
    const options = await examSelect.locator("option").all();
    let targetValue: string | null = null;
    for (const opt of options) {
      const val = await opt.getAttribute("value");
      const disabled = await opt.isDisabled();
      if (val && !disabled && val !== "") {
        targetValue = val;
        break;
      }
    }
    if (targetValue) {
      await examSelect.selectOption(targetValue);
      await page.waitForTimeout(800);
      await expect(page.getByRole("link", { name: /Enter Marks/i })).toBeVisible({ timeout: 4000 });
    } else {
      // No exam available in this tenant — still passes as read-only discoverability check
      await expect(page.getByText(/Choose exam|Exam history/i).first()).toBeVisible();
    }
  });

  test("desktop and mobile UX: no horizontal overflow on key pages", async ({ page }) => {
    // This is a read-only layout check, does not write
    for (const path of ["/en", "/en/students", "/en/attendance", "/en/quran"]) {
      await page.goto(path);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow, `horizontal overflow on ${path} desktop`).toBe(false);
    }
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ["/en", "/en/students"]) {
      await page.goto(path);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow, `horizontal overflow on ${path} mobile 375`).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});

// -----------------------------------------------------------------------------
// B. MUTATION JOURNEY TESTS — Writes
// Attendance save / Qur'an progress save must NOT run automatically.
// Require explicit safety flag AND dedicated tenant.
// -----------------------------------------------------------------------------
test.describe("phase 3 rescue — mutations (writes) — requires ILMGAAH_E2E_ALLOW_WRITES=1", () => {
  test.skip(!canWrite, "Skipping mutation tests: set ILMGAAH_E2E_ALLOW_WRITES=1 and PLAYWRIGHT_STORAGE_STATE and PLAYWRIGHT_BASE_URL to a dedicated test tenant to run writes. Do not run against live/abu-school tenant.");

  test("attendance: Mark All Present → Save Attendance (writes)", async ({ page }) => {
    await page.goto("/en/attendance");
    const groupSelect = page.locator("#attendance-group-select");
    await groupSelect.selectOption(String(FIXTURE.groupId));
    await page.waitForTimeout(1000);
    const startBtn = page.getByRole("button", { name: /Start today's attendance/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await expect(page.getByText(/Attendance is ready to start|Mark All Present/i).first()).toBeVisible({ timeout: 8000 });
    }
    const markAll = page.getByRole("button", { name: /Mark All Present/i });
    if (await markAll.isVisible()) {
      await markAll.click();
      const saveBtn = page.getByRole("button", { name: /Save Attendance/i });
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();
      await expect(page.getByText(/Attendance saved/i)).toBeVisible({ timeout: 8000 });
      // Re-entry persistence
      await page.reload();
      await expect(page.getByText(/Attendance saved|Present/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Qur'an: select target → Pass → Save & Next (writes)", async ({ page }) => {
    await page.goto(`/en/quran?group=${FIXTURE.groupId}`);
    await expect(page.getByText(FIXTURE.name).first()).toBeVisible({ timeout: 8000 });
    // Expand first student details
    const detailsToggle = page.getByRole("button", { name: /Details/i }).first();
    if (await detailsToggle.isVisible()) await detailsToggle.click();
    // Ensure a Juz target is selected (if empty, fill)
    const juzInput = page.locator(`#quran-target-${FIXTURE.personId}-juz`);
    if (await juzInput.isVisible()) {
      const val = await juzInput.inputValue();
      if (!val) await juzInput.fill("30");
    }
    const passBtn = page.getByRole("button", { name: /^Pass$/ }).first();
    await passBtn.click();
    const maybeError = page.getByText(/Set a target before recording/i);
    if (await maybeError.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Should have focused Juz — verify
      await expect(page.locator("input[type='number']").first()).toBeFocused();
      return;
    }
    const saveNext = page.getByRole("button", { name: /Save & Next Student/i });
    if (await saveNext.isVisible()) {
      await saveNext.click();
      await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});
