import { type Page, expect } from '@playwright/test';

/**
 * Page helper for the New Appointment drawer on /appointments.
 */
export class AppointmentFormHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openFromButton() {
    await this.page.getByTestId('new-appointment-button').click();
    await this.page.getByTestId('appointment-patient-select').waitFor({ state: 'visible' });
  }

  /**
   * Open the New Appointment drawer by clicking an empty day-view time slot.
   * This is the most reliable way to set both the date and time because the
   * form is pre-filled from the slot.
   */
  async openFromTimeSlot(hour: number) {
    const slot = this.page.getByTestId(`time-slot-${hour}`).first();
    await slot.waitFor({ state: 'visible', timeout: 10000 });
    await slot.click();
    await this.page.getByTestId('appointment-patient-select').waitFor({ state: 'visible', timeout: 15000 });
  }

  async selectDateFromCalendar(date: Date) {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    await this.page.getByTestId(`calendar-day-${dateStr}`).click();
  }

  /**
   * Navigate the calendar to the month containing `date` by clicking the
   * prev/next buttons the appropriate number of times. Must be called while
   * in Month view.
   */
  async navigateToMonth(targetDate: Date) {
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    // The header label is the Title (h4) showing "Month YYYY"
    const headerLabel = this.page.locator('h4.ant-typography').first();

    for (let i = 0; i < 24; i++) {
      const text = (await headerLabel.textContent()) || '';
      // Parse "Month YYYY" format
      const match = text.match(/(\w+)\s+(\d{4})/);
      if (!match) break;
      const displayedMonth = new Date(`${match[1]} 1, ${match[2]}`);
      const diff = (target.getFullYear() - displayedMonth.getFullYear()) * 12 + (target.getMonth() - displayedMonth.getMonth());
      if (diff === 0) return;
      // The nav bar has prev (1st) and next (2nd) buttons in a Space
      const navButtons = this.page.locator('.ant-space .ant-btn:not(:has-text("Today"))');
      const navButton = diff > 0 ? navButtons.nth(1) : navButtons.nth(0);
      await navButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  private async selectAntOption(selectTestId: string, optionText: string, exact = true) {
    const select = this.page.getByTestId(selectTestId);
    await select.click();
    // Ant Design renders the dropdown portal at the end of the body. Only
    // target the visible dropdown so we don't accidentally click a stale
    // hidden one from a different Select.
    const dropdown = this.page.locator('.ant-select-dropdown:visible');
    const option = dropdown
      .filter({ hasText: optionText })
      .getByText(optionText, { exact })
      .first();
    await option.click();
    await expect(select).toContainText(optionText, { timeout: 5000 });
  }

  async selectPatient(patientName: string) {
    await this.selectAntOption('appointment-patient-select', patientName, false);
  }

  async selectProvider(providerName: string) {
    await this.selectAntOption('appointment-provider-select', providerName, false);
  }

  async selectType(typeLabel: string) {
    await this.selectAntOption('appointment-type-select', typeLabel, true);
  }

  async setDate(date: Date) {
    const datePicker = this.page.getByTestId('appointment-date-picker');
    await datePicker.click();

    // Ant Design date cells expose a title attribute with the ISO date
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const cell = this.page.locator(`.ant-picker-cell[title="${dateStr}"]`);
    await cell.click();

    // Collapse the picker so it doesn't intercept later clicks
    await this.page.keyboard.press('Escape');
  }

  async setTimeRange(startTime: string, endTime: string) {
    const rangePicker = this.page.getByTestId('appointment-time-range-picker');
    const inputs = rangePicker.locator('input');
    await inputs.nth(0).fill(startTime);
    await inputs.nth(0).press('Tab');
    await inputs.nth(1).fill(endTime);
    await inputs.nth(1).press('Enter');
  }

  async enableTelehealth() {
    const switchEl = this.page.getByTestId('appointment-telehealth-switch');
    const input = switchEl.locator('input');
    const isChecked = await input.isChecked().catch(() => false);
    if (!isChecked) {
      await switchEl.click();
    }
  }

  async submit() {
    await this.page.getByTestId('appointment-schedule-button').click();
  }

  async expectSuccessMessage(message = 'Appointment created successfully') {
    await expect(this.page.locator('.ant-message')).toContainText(message, { timeout: 10000 });
  }

  // ── Filter helpers ──

  /**
   * Select an option from an Ant Design Select identified by its data-testid.
   * Works for both the calendar nav bar filters and the list view filters.
   */
  async selectFilterOption(filterTestId: string, optionText: string) {
    // Ant Design v6 Select doesn't respond reliably to Playwright's
    // click/keyboard events for selecting options. The AppointmentPage
    // component exposes its filter setter functions on `window` for E2E
    // tests. We map the data-testid to the appropriate setter and call
    // it with the option's value.
    //
    // The option values are looked up from the Select's options prop via
    // the React fiber tree, so this approach works for any Select that
    // has both `data-testid` and `options` props set.
    const setterMap: Record<string, string> = {
      'list-status-filter': '__setStatusFilter',
      'list-type-filter': '__setTypeFilter',
      'list-provider-filter': '__setProviderFilter',
      'calendar-status-filter': '__setStatusFilter',
      'calendar-provider-filter': '__setProviderFilter',
    };

    const setterName = setterMap[filterTestId];
    if (!setterName) {
      throw new Error(`No setter mapping for data-testid="${filterTestId}"`);
    }

    // Look up the option value from the Select's options prop via fiber
    const optionValue = await this.page.evaluate(({ testId, label, setter }) => {
      const setterFn = (window as any)[setter];
      if (!setterFn) throw new Error(`window.${setter} not found`);

      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (!el) throw new Error(`Element with data-testid="${testId}" not found`);

      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
      if (!fiberKey) throw new Error('No React fiber found');

      const selectFiber = (el as any)[fiberKey];

      // Walk up the fiber tree to find the options prop
      let options: Array<{ label: string; value: any }> | null = null;
      let f = selectFiber;
      for (let i = 0; i < 10 && f; i++) {
        if (f.memoizedProps?.options && !options) {
          options = f.memoizedProps.options;
          break;
        }
        f = f.return;
      }

      if (!options) throw new Error('options not found in fiber tree');

      const option = options.find((o: any) => o.label === label);
      if (!option) throw new Error(`Option "${label}" not found in options`);

      // Call the setter function — this triggers a proper React state
      // update and re-render.
      setterFn(option.value);
      return option.value;
    }, { testId: filterTestId, label: optionText, setter: setterName });

    await this.page.waitForTimeout(500);
  }

  /**
   * Clear an Ant Design Select filter (clicks the clear/x icon).
   */
  async clearFilter(filterTestId: string) {
    // Use the window-exposed setter to clear the filter (same approach
    // as selectFilterOption).
    const setterMap: Record<string, string> = {
      'list-status-filter': '__setStatusFilter',
      'list-type-filter': '__setTypeFilter',
      'list-provider-filter': '__setProviderFilter',
      'calendar-status-filter': '__setStatusFilter',
      'calendar-provider-filter': '__setProviderFilter',
    };

    const setterName = setterMap[filterTestId];
    if (!setterName) {
      throw new Error(`No setter mapping for data-testid="${filterTestId}"`);
    }

    await this.page.evaluate((setter) => {
      const setterFn = (window as any)[setter];
      if (setterFn) setterFn(undefined);
    }, setterName);

    await this.page.waitForTimeout(500);
  }

  /**
   * Switch the scheduler to a given view via the Segmented control.
   */
  async switchView(viewLabel: 'Day' | 'Week' | 'Month' | 'Year' | 'List') {
    await this.page.locator('.ant-segmented').getByText(viewLabel).click();
  }

  /**
   * Wait for the New Appointment drawer to fully close.
   */
  async waitForDrawerClosed() {
    await this.page.locator('.ant-drawer-mask').waitFor({ state: 'detached' });
  }

  /**
   * Sort the List view table by the Date / Time column in descending order
   * so future appointments (created by E2E tests) appear on the first page.
   * The column defaults to ascending, so a single click switches to desc.
   */
  async sortListByDateDesc() {
    const header = this.page.locator('.ant-table-thead th').filter({ hasText: 'Date / Time' });
    await header.click();
    await this.page.waitForTimeout(500);
  }
}
