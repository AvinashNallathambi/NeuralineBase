import { test, expect } from './fixtures/auth';
import { AppointmentFormHelper } from './helpers/appointment-form';

test.describe('Telehealth Appointment', () => {
  test('staff can create a telehealth appointment and join the call without errors', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    // Collect any console errors / page errors so we can fail the test if the
    // front-end or back-end throws while joining the call.
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    // Mock WebRTC so Playwright can exercise the telemedicine call page in a
    // headless browser without a second peer or real camera/microphone. The
    // socket connection to the backend is still real; we just avoid ICE/SDP
    // failures that would produce console errors.
    await page.addInitScript(() => {
      class MockRTCPeerConnection {
        localDescription: RTCSessionDescriptionInit | null = null;
        remoteDescription: RTCSessionDescriptionInit | null = null;
        connectionState = 'connecting';
        signalingState = 'stable';
        ontrack: ((event: RTCTrackEvent) => void) | null = null;
        onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
        onconnectionstatechange: (() => void) | null = null;

        addTrack() {}
        addStream() {}

        async createOffer(): Promise<RTCSessionDescriptionInit> {
          return { type: 'offer', sdp: '' };
        }

        async createAnswer(): Promise<RTCSessionDescriptionInit> {
          return { type: 'answer', sdp: '' };
        }

        async setLocalDescription(desc?: RTCSessionDescriptionInit): Promise<void> {
          this.localDescription = desc || this.localDescription;
        }

        async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
          this.remoteDescription = desc;
        }

        async addIceCandidate(): Promise<void> {}

        close(): void {
          this.connectionState = 'closed';
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).RTCPeerConnection = MockRTCPeerConnection;

      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => new MediaStream(),
      });
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
        value: async () => new MediaStream(),
      });
    });

    const form = new AppointmentFormHelper(page);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Switch to the day view for tomorrow and open the 10 AM time slot
    await form.selectDateFromCalendar(tomorrow);
    await form.openFromTimeSlot(10);

    // Create a telehealth appointment
    await form.selectPatient('E2E Patient');
    await form.selectProvider('Sarah');
    await form.selectType('Telehealth');
    await form.enableTelehealth();

    await form.submit();
    await form.expectSuccessMessage('Appointment created successfully');

    // Wait for the New Appointment drawer to fully close before interacting
    // with the calendar/list segmented control.
    await page.locator('.ant-drawer-mask').waitFor({ state: 'detached' });

    // Switch to list view to find the join call action reliably
    await page.locator('.ant-segmented').getByText('List').click();
    await page.locator('.ant-table-row').first().waitFor();

    // Wait for the new appointment row to appear and click Join Call
    const telehealthRow = page.locator('.ant-table-row').filter({ hasText: 'E2E Patient' }).filter({ hasText: 'Telehealth' });
    const joinCallButton = telehealthRow.getByTestId('join-call-button');
    await expect(joinCallButton).toBeVisible({ timeout: 10000 });

    await joinCallButton.click();
    await page.waitForURL(/\/telemedicine\/[a-f0-9-]+/);

    // Validate we landed on the telemedicine call page and the session loaded
    await expect(page.getByText('Telehealth Visit')).toBeVisible();

    // The call should attempt to connect. Without a second peer it will stay in
    // "Connecting" / "Waiting for patient", which is expected. We just want to
    // confirm the socket handshake and page render did not produce any front-end
    // or back-end visible errors.
    await expect(page.getByText(/Connecting|Waiting for patient|In Call/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Cannot start visit')).not.toBeVisible();
    await expect(page.getByText('Failed to start telehealth session')).not.toBeVisible();

    // Fail if any console / page errors occurred
    expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${pageErrors.map((e) => e.message).join('\n')}`).toHaveLength(0);
  });
});
