import { test, expect } from './fixtures/auth';
import { AppointmentFormHelper } from './helpers/appointment-form';

test.describe('Appointment Scheduler', () => {
  test('staff can create a new in-person appointment and see it on the calendar', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    const form = new AppointmentFormHelper(page);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Click the day cell for tomorrow to switch to day view
    await form.selectDateFromCalendar(tomorrow);

    // Click an empty 9:00 AM time slot — this opens the New Appointment drawer
    // with the date and time range already populated.
    await form.openFromTimeSlot(9);

    // Patients and providers are auto-populated from the backend
    await form.selectPatient('E2E Patient');
    await form.selectProvider('Sarah');
    await form.selectType('New Patient');

    await form.submit();
    await form.expectSuccessMessage();

    // Verify the appointment appears on the calendar for the selected day
    await expect(page.getByTestId('appointment-card').filter({ hasText: 'E2E Patient' })).toBeVisible();
  });
});
