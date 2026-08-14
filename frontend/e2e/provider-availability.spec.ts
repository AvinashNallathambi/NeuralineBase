import { test, expect } from './fixtures/auth';
import type { Page } from '@playwright/test';
import { request } from '@playwright/test';
import { readAuthState } from './global.setup';
import {
  createAvailabilityViaApi,
  deleteAvailabilityViaApi,
  getAvailabilityByProviderViaApi,
  createOverrideViaApi,
  deleteOverrideViaApi,
  getAllOverridesViaApi,
  getAllUsersViaApi,
} from './helpers/api';
import { TEST_USER } from './global.setup';

/**
 * Re-login to get a fresh token (the original token may have expired after 15 minutes).
 * Returns a new E2EState with a fresh token.
 */
async function getFreshState() {
  const state = readAuthState();
  const context = await request.newContext({ baseURL: 'http://localhost:4000', timeout: 30000 });
  try {
    const response = await context.post('/api/v1/auth/login', {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    if (!response.ok()) {
      throw new Error(`Login failed (${response.status()})`);
    }
    const data = await response.json();
    return { ...state, token: data.accessToken as string };
  } finally {
    await context.dispose();
  }
}

/**
 * E2E tests for the Provider Availability feature.
 *
 * These tests use the form instance (exposed via window.__E2E_scheduleForm and
 * window.__E2E_overrideForm) to set form values directly, bypassing the Ant
 * Design Select/TimePicker/DatePicker components which are difficult to drive
 * from Playwright due to React's synthetic event system.
 */

// Use weekend days + unique times to avoid conflicts with existing schedules.
const uniqueHour = 18 + Math.floor(Math.random() * 2); // 18 or 19
const uniqueMin = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, or 45
const startTime = `${String(uniqueHour).padStart(2, '0')}:${String(uniqueMin).padStart(2, '0')}`;
const endTime = `${String(uniqueHour + 2).padStart(2, '0')}:${String(uniqueMin).padStart(2, '0')}`;
const blockedStart = `${String(uniqueHour).padStart(2, '0')}:${String((uniqueMin + 15) % 60).padStart(2, '0')}`;
const blockedEnd = `${String(uniqueHour + 1).padStart(2, '0')}:${String((uniqueMin + 30) % 60).padStart(2, '0')}`;

// Backend stores times with seconds suffix ("HH:00:00")
const startTimeApi = `${startTime}:00`;
const endTimeApi = `${endTime}:00`;
const blockedStartApi = `${blockedStart}:00`;
const blockedEndApi = `${blockedEnd}:00`;

// Use unique override dates (far future) to avoid conflicts
const overrideDate = new Date();
overrideDate.setDate(overrideDate.getDate() + 365 + Math.floor(Math.random() * 100));
const overrideDateStr = overrideDate.toISOString().split('T')[0];

const overrideDate2 = new Date();
overrideDate2.setDate(overrideDate2.getDate() + 400 + Math.floor(Math.random() * 100));
const overrideDate2Str = overrideDate2.toISOString().split('T')[0];

// Unique notes to identify test-created data for cleanup
const scheduleNotes = `E2E-schedule-${Date.now()}`;
const blockNotes = `E2E-block-${Date.now()}`;
const overrideReason = `E2E-override-${Date.now()}`;
const override2Reason = `E2E-modified-${Date.now()}`;

/** Wait for the provider detail page to load. */
async function waitForDetailPage(page: Page) {
  await expect(page.getByTestId('add-schedule-block-button')).toBeVisible({ timeout: 30000 });
}

/**
 * Set the schedule form values via the form instance.
 * This bypasses Ant Design Select/TimePicker which are hard to drive from Playwright.
 */
async function setScheduleFormValues(
  page: Page,
  values: {
    dayOfWeek: number;
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    slotDuration: number;
    locationId?: string;
    notes?: string;
    isAvailable?: boolean;
  },
) {
  await page.evaluate((vals) => {
    const form = (window as any).__E2E_scheduleForm;
    const dayjs = (window as any).__E2E_dayjs;
    if (!form || !dayjs) throw new Error('Form or dayjs not available');

    form.setFieldsValue({
      dayOfWeek: vals.dayOfWeek,
      startTime: dayjs(vals.startTime, 'HH:mm'),
      endTime: dayjs(vals.endTime, 'HH:mm'),
      slotDuration: vals.slotDuration,
      locationId: vals.locationId ?? null,
      notes: vals.notes ?? null,
      isAvailable: vals.isAvailable ?? true,
      isRecurring: true,
      appointmentTypes: [],
      bufferMinutes: 0,
    });
  }, values);
}

/**
 * Set the override form values via the form instance.
 */
async function setOverrideFormValues(
  page: Page,
  values: {
    overrideDate: string; // "YYYY-MM-DD"
    overrideType: string;
    isAvailable?: boolean;
    startTime?: string; // "HH:mm"
    endTime?: string; // "HH:mm"
    reason?: string;
  },
) {
  await page.evaluate((vals) => {
    const form = (window as any).__E2E_overrideForm;
    const dayjs = (window as any).__E2E_dayjs;
    if (!form || !dayjs) throw new Error('Form or dayjs not available');

    form.setFieldsValue({
      overrideDate: dayjs(vals.overrideDate, 'YYYY-MM-DD'),
      overrideType: vals.overrideType,
      isAvailable: vals.isAvailable ?? false,
      startTime: vals.startTime ? dayjs(vals.startTime, 'HH:mm') : null,
      endTime: vals.endTime ? dayjs(vals.endTime, 'HH:mm') : null,
      reason: vals.reason ?? null,
      isRecurring: false,
    });
  }, values);
}

test.describe('Provider Availability', () => {
  const createdScheduleIds: string[] = [];
  const createdOverrideIds: string[] = [];

  test.beforeAll(async () => {
    // Clean up any leftover E2E schedules and overrides from previous test runs
    const state = readAuthState();
    const providerId = state.providerId;

    try {
      const schedules = await getAvailabilityByProviderViaApi(state, providerId);
      for (const s of schedules) {
        const notes = String(s.notes ?? '');
        const location = String(s.locationId ?? '');
        if (notes.startsWith('E2E') || location.startsWith('e2e')) {
          try {
            await deleteAvailabilityViaApi(state, s.id);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    try {
      const overrides = await getAllOverridesViaApi(state);
      for (const o of overrides) {
        if (o.providerId === providerId) {
          const reason = String(o.reason ?? '');
          if (reason.startsWith('E2E')) {
            try {
              await deleteOverrideViaApi(state, o.id);
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test.afterAll(async () => {
    const state = readAuthState();
    for (const id of createdScheduleIds) {
      try {
        await deleteAvailabilityViaApi(state, id);
      } catch {
        // Ignore
      }
    }
    for (const id of createdOverrideIds) {
      try {
        await deleteOverrideViaApi(state, id);
      } catch {
        // Ignore
      }
    }
  });

  // ── Add Schedule ──────────────────────────────────────────────────────

  test('Add Schedule creates a recurring availability block visible in UI and API', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    await page.getByTestId('add-schedule-block-button').click();
    await expect(page.getByTestId('schedule-drawer')).toBeVisible();
    await page.waitForTimeout(500);

    await setScheduleFormValues(page, {
      dayOfWeek: 0, // Sunday
      startTime,
      endTime,
      slotDuration: 30,
      locationId: 'e2e-main-clinic',
      notes: scheduleNotes,
      isAvailable: true,
    });

    await page.getByTestId('schedule-submit-button').click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/schedule block added/i, { timeout: 10000 });
    await expect(page.getByTestId('schedule-drawer')).not.toBeVisible({ timeout: 5000 });

    // Verify the schedule appears in the UI table
    const scheduleTable = page.getByTestId('schedule-table');
    const sundayRow = scheduleTable.locator('.ant-table-row').filter({ hasText: 'Sunday' }).filter({ hasText: scheduleNotes }).first();
    await expect(sundayRow).toBeVisible({ timeout: 10000 });
    await expect(sundayRow).toContainText(startTime);
    await expect(sundayRow).toContainText('Available');

    // ── Verify data is reflected in the API ──
    const apiSchedules = await getAvailabilityByProviderViaApi(e2eState, providerId);
    const found = apiSchedules.find(
      (s) =>
        s.dayOfWeek === 0 &&
        s.startTime === startTimeApi &&
        s.endTime === endTimeApi &&
        s.locationId === 'e2e-main-clinic',
    );
    expect(found).toBeTruthy();
    expect(found!.isAvailable).toBe(true);
    expect(found!.slotDuration).toBe(30);
    expect(found!.notes).toBe(scheduleNotes);

    if (found?.id) createdScheduleIds.push(found.id);
  });

  // ── Block (schedule with isAvailable=false) ───────────────────────────

  test('Block creates an unavailable schedule block visible in UI and API', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    await page.getByTestId('add-schedule-block-button').click();
    await expect(page.getByTestId('schedule-drawer')).toBeVisible();
    await page.waitForTimeout(500);

    await setScheduleFormValues(page, {
      dayOfWeek: 6, // Saturday
      startTime: blockedStart,
      endTime: blockedEnd,
      slotDuration: 30,
      notes: blockNotes,
      isAvailable: false,
    });

    await page.getByTestId('schedule-submit-button').click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/schedule block added/i, { timeout: 10000 });
    await expect(page.getByTestId('schedule-drawer')).not.toBeVisible({ timeout: 5000 });

    // Verify the block appears in the UI table with "Blocked" status
    const scheduleTable = page.getByTestId('schedule-table');
    const blockedRow = scheduleTable.locator('.ant-table-row').filter({ hasText: 'Saturday' }).filter({ hasText: blockNotes }).first();
    await expect(blockedRow).toBeVisible({ timeout: 10000 });
    await expect(blockedRow).toContainText('Blocked');

    // ── Verify data is reflected in the API ──
    const apiSchedules = await getAvailabilityByProviderViaApi(e2eState, providerId);
    const found = apiSchedules.find(
      (s) =>
        s.dayOfWeek === 6 &&
        s.startTime === blockedStartApi &&
        s.endTime === blockedEndApi,
    );
    expect(found).toBeTruthy();
    expect(found!.isAvailable).toBe(false);
    expect(found!.notes).toBe(blockNotes);

    if (found?.id) createdScheduleIds.push(found.id);
  });

  // ── Add Override (time off) ───────────────────────────────────────────

  test('Add Override creates a time-off override visible in UI and API', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    // Switch to the Overrides tab
    await page.locator('.ant-tabs-tab').filter({ hasText: /Overrides/ }).click();
    await expect(page.getByTestId('override-table')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('add-override-button').click();
    await expect(page.getByTestId('override-drawer')).toBeVisible();
    await page.waitForTimeout(500);

    await setOverrideFormValues(page, {
      overrideDate: overrideDateStr,
      overrideType: 'time_off',
      isAvailable: false,
      reason: overrideReason,
    });

    await page.getByTestId('override-submit-button').click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/override added/i, { timeout: 10000 });
    await expect(page.getByTestId('override-drawer')).not.toBeVisible({ timeout: 5000 });

    // Verify the override appears in the UI table
    const overrideTable = page.getByTestId('override-table');
    const overrideRow = overrideTable.locator('.ant-table-row').filter({ hasText: 'Time Off' }).filter({ hasText: overrideReason }).first();
    await expect(overrideRow).toBeVisible({ timeout: 10000 });

    // ── Verify data is reflected in the API ──
    const allOverrides = await getAllOverridesViaApi(e2eState);
    const found = allOverrides.find(
      (o) =>
        o.providerId === providerId &&
        o.overrideDate === overrideDateStr &&
        o.overrideType === 'time_off',
    );
    expect(found).toBeTruthy();
    expect(found!.reason).toBe(overrideReason);
    expect(found!.isAvailable).toBe(false);

    if (found?.id) createdOverrideIds.push(found.id);
  });

  // ── Add Override with modified hours ──────────────────────────────────

  test('Add Override with modified hours creates an override with custom times', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;
    const modStart = `${String(uniqueHour).padStart(2, '0')}:30`;
    const modEnd = `${String(uniqueHour + 4).padStart(2, '0')}:30`;
    const modStartApi = `${modStart}:00`;
    const modEndApi = `${modEnd}:00`;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    await page.locator('.ant-tabs-tab').filter({ hasText: /Overrides/ }).click();
    await expect(page.getByTestId('override-table')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('add-override-button').click();
    await expect(page.getByTestId('override-drawer')).toBeVisible();
    await page.waitForTimeout(500);

    await setOverrideFormValues(page, {
      overrideDate: overrideDate2Str,
      overrideType: 'modified_hours',
      isAvailable: true,
      startTime: modStart,
      endTime: modEnd,
      reason: override2Reason,
    });

    await page.getByTestId('override-submit-button').click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/override added/i, { timeout: 10000 });
    await expect(page.getByTestId('override-drawer')).not.toBeVisible({ timeout: 5000 });

    // Verify the override appears in the UI table
    const overrideTable = page.getByTestId('override-table');
    const overrideRow = overrideTable.locator('.ant-table-row').filter({ hasText: 'Modified Hours' }).filter({ hasText: override2Reason }).first();
    await expect(overrideRow).toBeVisible({ timeout: 10000 });
    await expect(overrideRow).toContainText(modStart);

    // ── Verify data is reflected in the API ──
    const allOverrides = await getAllOverridesViaApi(e2eState);
    const found = allOverrides.find(
      (o) =>
        o.providerId === providerId &&
        o.overrideDate === overrideDate2Str &&
        o.overrideType === 'modified_hours',
    );
    expect(found).toBeTruthy();
    expect(found!.startTime).toBe(modStartApi);
    expect(found!.endTime).toBe(modEndApi);
    expect(found!.isAvailable).toBe(true);
    expect(found!.reason).toBe(override2Reason);

    if (found?.id) createdOverrideIds.push(found.id);
  });

  // ── Provider Info ─────────────────────────────────────────────────────

  test('Provider Info tab displays provider details correctly', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;

    // Fetch the provider's info from the API to know what to assert
    // Use a fresh token in case the original has expired
    const freshState = await getFreshState();
    const users = await getAllUsersViaApi(freshState);
    const provider = users.find((u) => u.id === providerId);
    expect(provider).toBeTruthy();
    const providerName = `${provider!.firstName} ${provider!.lastName}`;
    const providerEmail = provider!.email;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    // Switch to the Provider Info tab
    await page.locator('.ant-tabs-tab').filter({ hasText: /Provider Info/ }).click();

    // Wait for the descriptions to be visible
    const descriptions = page.getByTestId('provider-info-descriptions');
    await expect(descriptions).toBeVisible({ timeout: 15000 });

    // Verify the provider name, email, and status are displayed
    // Note: data-testid on Descriptions.Item doesn't get transferred to the rendered HTML,
    // so we check the text content of the descriptions element instead.
    await expect(descriptions).toContainText(providerName, { timeout: 10000 });
    await expect(descriptions).toContainText(providerEmail);
    await expect(descriptions).toContainText('Active');
  });

  // ── Delete Schedule via UI ────────────────────────────────────────────

  test('Delete Schedule removes the block from UI and API', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;
    const delNotes = `E2E-delete-${Date.now()}`;

    // Create a schedule via the API first (use fresh token to avoid expiration)
    const freshState = await getFreshState();
    const created = await createAvailabilityViaApi(freshState, {
      providerId,
      dayOfWeek: 4, // Thursday
      startTime: '11:00',
      endTime: '13:00',
      slotDuration: 30,
      isAvailable: true,
      notes: delNotes,
    });
    const scheduleId = created.id;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    const scheduleTable = page.getByTestId('schedule-table');
    const thuRow = scheduleTable.locator('.ant-table-row').filter({ hasText: 'Thursday' }).filter({ hasText: delNotes }).first();
    await expect(thuRow).toBeVisible({ timeout: 10000 });

    await thuRow.getByTestId('delete-schedule-button').click();

    const confirmButton = page.locator('.ant-popconfirm').getByRole('button', { name: /ok|yes|confirm/i }).first();
    await confirmButton.click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/schedule block removed/i, { timeout: 10000 });
    await expect(thuRow).toHaveCount(0, { timeout: 10000 });

    // ── Verify data is reflected in the API ──
    const apiSchedules = await getAvailabilityByProviderViaApi(freshState, providerId);
    const stillExists = apiSchedules.find((s) => s.id === scheduleId);
    expect(stillExists).toBeUndefined();
  });

  // ── Delete Override via UI ────────────────────────────────────────────

  test('Delete Override removes the override from UI and API', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const providerId = e2eState.providerId;
    const delOverrideDate = new Date();
    delOverrideDate.setDate(delOverrideDate.getDate() + 500 + Math.floor(Math.random() * 100));
    const delOverrideDateStr = delOverrideDate.toISOString().split('T')[0];
    const delReason = `E2E-delete-override-${Date.now()}`;

    // Create an override via the API first (use fresh token to avoid expiration)
    const freshState = await getFreshState();
    const created = await createOverrideViaApi(freshState, {
      providerId,
      overrideDate: delOverrideDateStr,
      overrideType: 'holiday',
      isAvailable: false,
      reason: delReason,
    });
    const overrideId = created.id;

    await page.goto(`/provider-availability/${providerId}`);
    await waitForDetailPage(page);

    await page.locator('.ant-tabs-tab').filter({ hasText: /Overrides/ }).click();
    await expect(page.getByTestId('override-table')).toBeVisible({ timeout: 5000 });

    const overrideTable = page.getByTestId('override-table');
    const holidayRow = overrideTable.locator('.ant-table-row').filter({ hasText: 'Holiday' }).filter({ hasText: delReason }).first();
    await expect(holidayRow).toBeVisible({ timeout: 10000 });

    await holidayRow.getByTestId('delete-override-button').click();

    const confirmButton = page.locator('.ant-popconfirm').getByRole('button', { name: /ok|yes|confirm/i }).first();
    await confirmButton.click();

    await expect(page.locator('.ant-message-notice').last()).toContainText(/override removed/i, { timeout: 10000 });
    await expect(holidayRow).toHaveCount(0, { timeout: 10000 });

    // ── Verify data is reflected in the API ──
    const allOverrides = await getAllOverridesViaApi(freshState);
    const stillExists = allOverrides.find((o) => o.id === overrideId);
    expect(stillExists).toBeUndefined();
  });
});
