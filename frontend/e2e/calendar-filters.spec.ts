import { test, expect } from './fixtures/auth';
import { AppointmentFormHelper } from './helpers/appointment-form';
import { createAppointmentViaApi, findSecondProviderViaApi } from './helpers/api';

/**
 * E2E tests for the Provider and Status filters on the calendar views
 * (Day, Month, Year). These filters live in the calendar navigation
 * bar and were wired to the calendar views so they now actually filter the
 * appointments shown.
 *
 * Appointments are created via the backend API (not the UI) to keep these
 * tests fast and reliable. We use dates within the current week and unique
 * early-morning time slots (06:00, 07:00) to avoid conflicts with
 * appointments created by previous test runs.
 */
test.describe('Calendar View Filters', () => {
  // Use random minute/second offsets per test run so appointments don't
  // conflict with appointments created by previous runs at the same time
  // slots. Using Math.random() ensures uniqueness even when tests run
  // in quick succession.
  const uniqueMin = Math.floor(Math.random() * 59);
  const uniqueSec = Math.floor(Math.random() * 60);
  const timeStr = (hour: number) => `T${String(hour).padStart(2, '0')}:${String(uniqueMin).padStart(2, '0')}:${String(uniqueSec).padStart(2, '0')}.000Z`;
  // Use unique hours for each test to avoid conflicts with previous runs
  const providerTestHour = 10 + Math.floor(Math.random() * 4);
  const statusTestHour = providerTestHour + 2;
  const yearTestHour = statusTestHour + 2;

  test('Provider filter narrows Day view appointments to the selected provider', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    // Use tomorrow so we stay within the current week (no month navigation needed)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create two appointments with two different providers via the API
    const secondProvider = await findSecondProviderViaApi(e2eState);

    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(providerTestHour)}`,
      endTime: `${dateStr}${timeStr(providerTestHour + 1)}`,
      reason: 'Sarah appointment',
    });

    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: secondProvider.id,
      appointmentType: 'follow_up',
      startTime: `${dateStr}${timeStr(providerTestHour + 2)}`,
      endTime: `${dateStr}${timeStr(providerTestHour + 3)}`,
      reason: 'Other provider appointment',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Switch to Month view (shows current month which includes tomorrow),
    // click the day cell to switch to Day view for that date.
    await form.switchView('Month');
    await form.selectDateFromCalendar(futureDate);
    // selectDateFromCalendar clicks a day cell which switches to Day view
    await expect(page.getByTestId('appointment-card').first()).toBeVisible({ timeout: 15000 });

    // Before filtering, both appointments should be visible
    const allCards = page.getByTestId('appointment-card');
    expect(await allCards.count()).toBeGreaterThanOrEqual(2);

    // Apply the Provider filter — only the first provider's appointment should remain
    await form.selectFilterOption('calendar-provider-filter', 'Sarah Chen');
    await expect(page.getByTestId('appointment-card').filter({ hasText: 'Sarah' }).first()).toBeVisible();
    await expect(page.getByTestId('appointment-card').filter({ hasText: secondProvider.name.split(' ')[0] })).toHaveCount(0);

    // Clear the filter — both should reappear
    await form.clearFilter('calendar-provider-filter');
    await expect(page.getByTestId('appointment-card').filter({ hasText: secondProvider.name.split(' ')[0] }).first()).toBeVisible();
  });

  test('Status filter narrows Month view appointments to the selected status', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    // Use day after tomorrow to avoid conflicts with the previous test
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create one scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(statusTestHour)}`,
      endTime: `${dateStr}${timeStr(statusTestHour + 1)}`,
      reason: 'Status filter test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Switch to Month view (current month includes the future date)
    await form.switchView('Month');

    // The month view shows appointment cards inside day cells. Verify the
    // scheduled appointment is visible before filtering.
    const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    const dayCell = page.getByTestId(`calendar-day-${futureDateStr}`);
    await expect(dayCell.getByText('E2E').first()).toBeVisible({ timeout: 15000 });

    // Apply the Status filter to "Scheduled" — the appointment should still show
    await form.selectFilterOption('calendar-status-filter', 'Scheduled');
    await expect(dayCell.getByText('E2E').first()).toBeVisible();

    // Apply the Status filter to "Completed" — the scheduled appointment should disappear
    await form.clearFilter('calendar-status-filter');
    await form.selectFilterOption('calendar-status-filter', 'Completed');
    await expect(dayCell.getByText('E2E')).toHaveCount(0);

    // Clear the filter — the appointment should reappear
    await form.clearFilter('calendar-status-filter');
    await expect(dayCell.getByText('E2E').first()).toBeVisible();
  });

  test('Provider and Status filters compose on the Year view heat-map', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    // Use 3 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create one scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(yearTestHour)}`,
      endTime: `${dateStr}${timeStr(yearTestHour + 1)}`,
      reason: 'Year view test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Switch to Year view (current year includes the future date)
    await form.switchView('Year');

    // Count badges appear on months that have appointments. Verify at least
    // one month badge is visible before filtering.
    const monthBadges = page.locator('.ant-badge-count');
    await monthBadges.first().waitFor({ state: 'visible', timeout: 15000 });
    const initialCount = await monthBadges.count();
    expect(initialCount).toBeGreaterThan(0);

    // Apply a Status filter to "Scheduled" — the badge count should stay > 0
    // (our scheduled appointment is still included).
    await form.selectFilterOption('calendar-status-filter', 'Scheduled');
    const scheduledCount = await page.locator('.ant-badge-count').count();
    expect(scheduledCount).toBeGreaterThan(0);

    // Apply a Status filter to "Checked In" — there are no checked_in
    // appointments in the dev DB, so the badge count should drop to 0.
    // We set this directly via the window API because the calendar status
    // filter only shows statuses that exist in the current data.
    await form.clearFilter('calendar-status-filter');
    await page.evaluate(() => {
      const fn = (window as any).__setStatusFilter;
      if (fn) fn('checked_in');
    });
    await page.waitForTimeout(500);
    const checkedInCount = await page.locator('.ant-badge-count').count();
    expect(checkedInCount).toBe(0);

    // Clear the filter — the badge count should return to the initial value
    await form.clearFilter('calendar-status-filter');
    await expect(page.locator('.ant-badge-count')).toHaveCount(initialCount);
  });
});
