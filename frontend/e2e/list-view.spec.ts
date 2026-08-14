import { test, expect } from './fixtures/auth';
import { AppointmentFormHelper } from './helpers/appointment-form';
import { createAppointmentViaApi, findSecondProviderViaApi } from './helpers/api';

/**
 * E2E tests for the List view filters (Provider, Status, Type, Date Range)
 * and the per-row action buttons (Check In, Start, Complete, Cancel).
 *
 * Appointments are created via the backend API (not the UI) to keep these
 * tests fast and reliable. We use dates within the current week and unique
 * early-morning time slots to avoid conflicts with previous test runs.
 */
test.describe('List View Filters', () => {
  // Use a unique base offset per test run so appointments don't conflict with
  // appointments created by previous runs or by the calendar-filters tests.
  const baseOffset = 30 + (Date.now() % 200);
  const uniqueMin = Math.floor(Math.random() * 45);
  const uniqueSec = Math.floor(Math.random() * 60);
  const timeStr = (hour: number) => `T${String(hour).padStart(2, '0')}:${String(uniqueMin).padStart(2, '0')}:${String(uniqueSec).padStart(2, '0')}.000Z`;

  test('Provider filter narrows the appointment table to the selected provider', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create two appointments with two different providers via the API
    const secondProvider = await findSecondProviderViaApi(e2eState);

    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(6)}`,
      endTime: `${dateStr}${timeStr(7)}`,
      reason: 'Sarah appointment',
    });

    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: secondProvider.id,
      appointmentType: 'follow_up',
      startTime: `${dateStr}${timeStr(8)}`,
      endTime: `${dateStr}${timeStr(9)}`,
      reason: 'Other provider appointment',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    // Before filtering, both providers should appear
    expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(2);

    // Apply the Provider filter — only Sarah's rows should remain
    await form.selectFilterOption('list-provider-filter', 'Sarah Chen');
    const sarahRows = page.locator('.ant-table-row').filter({ hasText: 'Sarah' });
    const otherRows = page.locator('.ant-table-row').filter({ hasText: secondProvider.name.split(' ')[0] });
    await expect(sarahRows.first()).toBeVisible();
    await expect(otherRows).toHaveCount(0);

    // Clear the filter — both should reappear
    await form.clearFilter('list-provider-filter');
    await expect(page.locator('.ant-table-row').filter({ hasText: secondProvider.name.split(' ')[0] }).first()).toBeVisible();
  });

  test('Status filter narrows the appointment table to the selected status', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create one scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(6)}`,
      endTime: `${dateStr}${timeStr(7)}`,
      reason: 'Status filter test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    // Find the first scheduled E2E row and get its data-row-key to
    // identify it specifically throughout the test.
    const e2eRows = page.locator('.ant-table-row').filter({ hasText: 'E2E' });
    await expect(e2eRows.first()).toBeVisible({ timeout: 10000 });

    // Get the data-row-key of the first E2E row
    const rowKey = await e2eRows.first().getAttribute('data-row-key');
    expect(rowKey).toBeTruthy();
    const e2eRow = page.locator(`.ant-table-row[data-row-key="${rowKey}"]`);

    // Check in the E2E appointment via the UI
    await e2eRow.getByTestId('action-check-in').click();
    await expect(page.locator('.ant-message')).toContainText(/checked in/i, { timeout: 10000 });

    // Filter by "Scheduled" — the checked-in E2E row should disappear
    await form.selectFilterOption('list-status-filter', 'Scheduled');
    await expect(e2eRow).toHaveCount(0);

    // Filter by "Checked In" — the checked-in E2E row should appear
    await form.clearFilter('list-status-filter');
    await form.selectFilterOption('list-status-filter', 'Checked In');
    await expect(e2eRow).toBeVisible();

    // Clear the filter — the E2E row should still be visible
    await form.clearFilter('list-status-filter');
    await expect(e2eRow).toBeVisible({ timeout: 10000 });
  });

  test('Type filter narrows the appointment table to the selected type', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset + 2);
    const dateStr = futureDate.toISOString().split('T')[0];
    // Use unique hours based on timestamp to avoid conflicts with previous runs
    const hour1 = 10 + (Date.now() % 5);
    const hour2 = hour1 + 2;

    // Create a New Patient appointment
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(hour1)}`,
      endTime: `${dateStr}${timeStr(hour1 + 1)}`,
      reason: 'Type filter test 1',
    });

    // Create a Follow Up appointment
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'follow_up',
      startTime: `${dateStr}${timeStr(hour2)}`,
      endTime: `${dateStr}${timeStr(hour2 + 1)}`,
      reason: 'Type filter test 2',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    // Both E2E appointments should be on the first page after sorting by
    // date descending (they're far in the future).
    const e2eRows = page.locator('.ant-table-row').filter({ hasText: 'E2E' });
    await expect(e2eRows.first()).toBeVisible({ timeout: 10000 });
    const initialE2eCount = await e2eRows.count();
    expect(initialE2eCount).toBeGreaterThanOrEqual(2);

    // Apply the Type filter to "New Patient" — only the new patient row should remain
    await form.selectFilterOption('list-type-filter', 'New Patient');
    const newPatientRows = page.locator('.ant-table-row').filter({ hasText: 'New Patient' });
    const followUpRows = page.locator('.ant-table-row').filter({ hasText: 'Follow Up' });
    await expect(newPatientRows.first()).toBeVisible();
    await expect(followUpRows).toHaveCount(0);

    // Clear the filter — both E2E rows should reappear
    await form.clearFilter('list-type-filter');
    await page.waitForTimeout(1000);
    await expect(e2eRows).toHaveCount(initialE2eCount, { timeout: 10000 });
  });
});

test.describe('List View Actions', () => {
  // Use a different base offset from the Filters tests to avoid conflicts.
  // Use a large offset (500+ days) to ensure E2E appointments are the
  // furthest in the future and appear on the first page after sorting
  // by date descending.
  const baseOffset = 500 + (Date.now() % 200);
  const uniqueMin = Math.floor(Math.random() * 45) + 5;
  const uniqueSec = Math.floor(Math.random() * 60);
  const timeStr = (hour: number) => `T${String(hour).padStart(2, '0')}:${String(uniqueMin).padStart(2, '0')}:${String(uniqueSec).padStart(2, '0')}.000Z`;
  // Use unique hours for each test to avoid conflicts with previous runs
  const checkInHour = 2 + Math.floor(Math.random() * 3);
  const startHour = checkInHour + 2;
  const completeHour = startHour + 2;
  const cancelHour = completeHour + 2;

  test('Check In action moves a scheduled appointment to checked_in', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create a scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(checkInHour)}`,
      endTime: `${dateStr}${timeStr(checkInHour + 1)}`,
      reason: 'Check In test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    // The scheduled row should show a "Check In" button
    const scheduledRow = page.locator('.ant-table-row').filter({ hasText: 'E2E' }).first();
    const checkInButton = scheduledRow.getByTestId('action-check-in');
    await expect(checkInButton).toBeVisible();

    // Click Check In — the status should change to "Checked In"
    await checkInButton.click();
    await expect(page.locator('.ant-message')).toContainText(/checked in/i, { timeout: 10000 });

    // The row should now show "Start" (the checked_in state's next action)
    await expect(scheduledRow.getByTestId('action-start')).toBeVisible();
    await expect(scheduledRow.getByTestId('action-check-in')).toHaveCount(0);
  });

  test('Start action moves a checked_in appointment to in_progress', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create a scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(startHour)}`,
      endTime: `${dateStr}${timeStr(startHour + 1)}`,
      reason: 'Start action test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    const row = page.locator('.ant-table-row').filter({ hasText: 'E2E' }).first();

    // First, check in the appointment via the UI (Check In button works
    // because the store falls back to local state update)
    await row.getByTestId('action-check-in').click();
    await expect(page.locator('.ant-message')).toContainText(/checked in/i, { timeout: 10000 });
    await expect(row.getByTestId('action-start')).toBeVisible();

    // Click Start — the status should change to "In Progress"
    await row.getByTestId('action-start').click();
    await expect(page.locator('.ant-message')).toContainText(/in progress/i, { timeout: 10000 });

    // The row should now show "Complete"
    await expect(row.getByTestId('action-complete')).toBeVisible();
    await expect(row.getByTestId('action-start')).toHaveCount(0);
  });

  test('Complete action moves an in_progress appointment to completed', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset + 2);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create a scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(completeHour)}`,
      endTime: `${dateStr}${timeStr(completeHour + 1)}`,
      reason: 'Complete action test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    const row = page.locator('.ant-table-row').filter({ hasText: 'E2E' }).first();

    // Check in → Start via the UI
    await row.getByTestId('action-check-in').click();
    await expect(page.locator('.ant-message')).toContainText(/checked in/i, { timeout: 10000 });
    await row.getByTestId('action-start').click();
    await expect(page.locator('.ant-message')).toContainText(/in progress/i, { timeout: 10000 });

    // Click Complete — the status should change to "Completed"
    await expect(row.getByTestId('action-complete')).toBeVisible();
    await row.getByTestId('action-complete').click();
    await expect(page.locator('.ant-message')).toContainText(/completed/i, { timeout: 10000 });

    // The row should no longer show Check In / Start / Complete / Cancel
    await expect(row.getByTestId('action-check-in')).toHaveCount(0);
    await expect(row.getByTestId('action-start')).toHaveCount(0);
    await expect(row.getByTestId('action-complete')).toHaveCount(0);
    await expect(row.getByTestId('action-cancel')).toHaveCount(0);
  });

  test('Cancel action (with confirm) moves a scheduled appointment to cancelled', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + baseOffset + 3);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Create a scheduled appointment via the API
    await createAppointmentViaApi(e2eState, {
      patientId: e2eState.patientId,
      providerId: e2eState.providerId,
      appointmentType: 'new_patient',
      startTime: `${dateStr}${timeStr(cancelHour)}`,
      endTime: `${dateStr}${timeStr(cancelHour + 1)}`,
      reason: 'Cancel action test',
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    await form.switchView('List');
    await page.locator('.ant-table-row').first().waitFor();
    await form.sortListByDateDesc();

    const row = page.locator('.ant-table-row').filter({ hasText: 'E2E' }).first();
    const cancelButton = row.getByTestId('action-cancel');
    await expect(cancelButton).toBeVisible();

    // Click Cancel — a Popconfirm appears
    await cancelButton.click();
    const confirmButton = page.locator('.ant-popconfirm').getByRole('button', { name: /ok|yes|confirm/i }).first();
    await confirmButton.click();

    // The status should change to "Cancelled"
    await expect(page.locator('.ant-message')).toContainText(/cancelled/i, { timeout: 10000 });

    // The row should no longer show any action buttons
    await expect(row.getByTestId('action-check-in')).toHaveCount(0);
    await expect(row.getByTestId('action-start')).toHaveCount(0);
    await expect(row.getByTestId('action-complete')).toHaveCount(0);
    await expect(row.getByTestId('action-cancel')).toHaveCount(0);
  });
});
