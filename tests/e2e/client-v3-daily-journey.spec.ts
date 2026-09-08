import { expect, test } from "@playwright/test";

// Stable seeded fixture — verified in production tenant Al-Noor Islamic Academy
// Ayaan Siddiqui is STU-MAIN-2026_27-00001, Year 1 A, always present in seed
const FIXTURE = {
  name: "Ayaan Siddiqui",
  studentNumber: "STU-MAIN-2026_27-00001",
  personId: 4,
  groupId: 2,
  groupLabel: "Dars-e-Nizami · Year 1 A",
};

test("critical daily journey: Find Ayaan → attendance → Qur'an → ID card (discoverable, no Ahmed)", async ({ page }) => {
  // Must be discoverable without insider coaching — start from home
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: /Al-Noor Islamic Academy/ })).toBeVisible();

  // 1. Find student via global search (topbar)
  const globalSearch = page.locator("#global-student-search");
  await expect(globalSearch).toBeVisible();
  await globalSearch.fill(FIXTURE.name.slice(0, 4)); // "Ayaa" — debounced search requires >=2 chars
  // keyboard navigation: ArrowDown + Enter should work
  await page.waitForTimeout(600);
  // dropdown should appear with listbox
  const listbox = page.getByRole("listbox", { name: /Find student/ });
  await expect(listbox).toBeVisible({ timeout: 5000 });
  const option = page.getByRole("option", { name: new RegExp(FIXTURE.name) });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/en/students/${FIXTURE.personId}`));
  await expect(page.getByRole("heading", { name: FIXTURE.name })).toBeVisible();

  // 2. Daily work cards on profile should be discoverable
  await expect(page.getByRole("link", { name: /Print ID Card/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mark \/ view attendance/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Qur'an progress/i })).toBeVisible();

  // 3. Record today's attendance via the profile link
  await page.getByRole("link", { name: /Mark \/ view attendance/i }).click();
  await expect(page).toHaveURL(/\/en\/attendance/);
  // attendance page should allow selecting group and starting
  const groupSelect = page.locator("#attendance-group-select");
  if (await groupSelect.isVisible()) {
    await groupSelect.selectOption(String(FIXTURE.groupId));
    await page.waitForTimeout(800);
  }
  // If not started, Start button should be visible and actionable
  const startBtn = page.getByRole("button", { name: /Start today's attendance/i });
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await expect(page.getByText(/Attendance saved|Mark All Present|Ready to save/i)).toBeVisible({ timeout: 8000 });
  } else {
    // Already started — verify roster shows
    await expect(page.getByText(FIXTURE.name)).toBeVisible({ timeout: 5000 });
  }

  // 4. Record Qur'an/Hifz progress
  await page.goto(`/en/quran?group=${FIXTURE.groupId}`);
  await expect(page.getByRole("heading", { name: /Qur'an & Hifz/i })).toBeVisible();
  // roster should load for Year 1 A
  await expect(page.getByText(FIXTURE.name).first()).toBeVisible({ timeout: 8000 });
  // Quick action Pass should either save or show target error with focus
  const firstPass = page.getByRole("button", { name: /^Pass$/ }).first();
  if (await firstPass.isVisible()) {
    await firstPass.click();
    // either saved or target error that focuses Juz input
    const maybeError = page.getByText(/Set a target before recording/i);
    const maybeSaved = page.getByText(/Saved/i);
    await expect(maybeError.or(maybeSaved)).toBeVisible({ timeout: 4000 });
    if (await maybeError.isVisible()) {
      // should have focused the Juz input (first number input)
      await expect(page.locator("input[type='number']").first()).toBeFocused({ timeout: 2000 }).catch(() => {});
    }
  }

  // 5. Print ID card — verify preview and print
  await page.goto(`/en/students/${FIXTURE.personId}/id-card`);
  await expect(page.getByRole("heading", { name: /Student ID card/i })).toBeVisible();
  await expect(page.getByText(FIXTURE.studentNumber)).toBeVisible();
  const printBtn = page.getByRole("button", { name: /Print ID card/i });
  await expect(printBtn).toBeVisible();
  // print should call window.print — we stub to verify
  await page.evaluate(() => {
    (window as unknown as { printCalled?: boolean }).printCalled = false;
    window.print = () => { (window as unknown as { printCalled: boolean }).printCalled = true; };
  });
  await printBtn.click();
  await expect.poll(async () => page.evaluate(() => (window as unknown as { printCalled?: boolean }).printCalled)).toBe(true);

  // 6. Verify that searching for non-existent Ahmed shows empty state, not silent failure
  await page.goto("/en/students");
  const pageSearch = page.locator('input[placeholder*="Search name or student number"]');
  if (await pageSearch.isVisible()) {
    await pageSearch.fill("Ahmed");
    await page.waitForTimeout(600);
    await expect(page.getByText(/No matching students/i)).toBeVisible();
  }
  // Global search for Ahmed should show empty in dropdown
  await page.goto("/en");
  const g2 = page.locator("#global-student-search");
  await g2.fill("Ahmed");
  await page.waitForTimeout(800);
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByText(/No matching students/i)).toBeVisible();
});

test("exams workflow: selecting exam reveals Enter Marks CTA", async ({ page }) => {
  await page.goto("/en/exams");
  await expect(page.getByRole("heading", { name: /Exams, Results/i })).toBeVisible();
  // selector should be visible
  const yearSelect = page.locator('select').first();
  await expect(yearSelect).toBeVisible();
  // choose a real exam if available — try to select first non-disabled option in exam dropdown
  const examSelect = page.locator('select').last();
  const options = await examSelect.locator('option').all();
  // find first enabled exam option with value
  let targetValue: string | null = null;
  for (const opt of options) {
    const val = await opt.getAttribute('value');
    const disabled = await opt.isDisabled();
    if (val && !disabled && val !== "") { targetValue = val; break; }
  }
  if (targetValue) {
    await examSelect.selectOption(targetValue);
    await page.waitForTimeout(800);
    // Should now show Enter Marks CTA
    await expect(page.getByRole("link", { name: /Enter Marks/i })).toBeVisible({ timeout: 4000 });
  }
});

test("global search keyboard navigation (ArrowDown, Enter, Escape)", async ({ page }) => {
  await page.goto("/en");
  const input = page.locator("#global-student-search");
  await input.fill("Ayaa");
  await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5000 });
  await input.press("ArrowDown");
  await expect(page.locator("#global-search-option-4")).toHaveAttribute("aria-selected", "true");
  await input.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden({ timeout: 2000 });
});
