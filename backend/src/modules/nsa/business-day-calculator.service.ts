import { Injectable } from '@nestjs/common';

@Injectable()
export class BusinessDayCalculator {
  // US federal holidays (fixed and floating)
  private readonly fixedHolidays: Array<{ month: number; day: number; name: string }> = [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 6, day: 19, name: 'Juneteenth' },
    { month: 7, day: 4, name: 'Independence Day' },
    { month: 11, day: 11, name: 'Veterans Day' },
    { month: 12, day: 25, name: 'Christmas Day' },
  ];

  /**
   * Returns the list of US federal holiday dates for a given year,
   * including floating holidays (MLK Day, Presidents Day, Memorial Day,
   * Labor Day, Columbus Day, Thanksgiving).
   */
  getFederalHolidays(year: number): Date[] {
    const holidays: Date[] = [];

    // Fixed holidays
    for (const h of this.fixedHolidays) {
      holidays.push(new Date(year, h.month - 1, h.day));
    }

    // MLK Day — 3rd Monday of January
    holidays.push(this.getNthWeekday(year, 0, 1, 3));
    // Presidents Day — 3rd Monday of February
    holidays.push(this.getNthWeekday(year, 1, 1, 3));
    // Memorial Day — last Monday of May
    holidays.push(this.getLastWeekday(year, 4, 1));
    // Labor Day — 1st Monday of September
    holidays.push(this.getNthWeekday(year, 8, 1, 1));
    // Columbus Day — 2nd Monday of October
    holidays.push(this.getNthWeekday(year, 9, 1, 2));
    // Thanksgiving — 4th Thursday of November
    holidays.push(this.getNthWeekday(year, 10, 4, 4));

    return holidays;
  }

  private getNthWeekday(year: number, month: number, dayOfWeek: number, n: number): Date {
    const date = new Date(year, month, 1);
    let count = 0;
    while (date.getMonth() === month) {
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === n) return new Date(date);
      }
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  private getLastWeekday(year: number, month: number, dayOfWeek: number): Date {
    const date = new Date(year, month + 1, 0); // last day of month
    while (date.getMonth() === month) {
      if (date.getDay() === dayOfWeek) return new Date(date);
      date.setDate(date.getDate() - 1);
    }
    return date;
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  isFederalHoliday(date: Date): boolean {
    const holidays = this.getFederalHolidays(date.getFullYear());
    return holidays.some((h) => h.toDateString() === date.toDateString());
  }

  isBusinessDay(date: Date): boolean {
    return !this.isWeekend(date) && !this.isFederalHoliday(date);
  }

  /**
   * Adds N business days to the start date, skipping weekends and federal holidays.
   */
  addBusinessDays(startDate: Date, businessDays: number): Date {
    const result = new Date(startDate);
    let added = 0;
    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      if (this.isBusinessDay(result)) {
        added++;
      }
    }
    return result;
  }

  /**
   * Subtracts N business days from the target date (for calculating deadlines
   * that are N business days *before* a service date).
   */
  subtractBusinessDays(targetDate: Date, businessDays: number): Date {
    const result = new Date(targetDate);
    let subtracted = 0;
    while (subtracted < businessDays) {
      result.setDate(result.getDate() - 1);
      if (this.isBusinessDay(result)) {
        subtracted++;
      }
    }
    return result;
  }

  /**
   * Counts business days between two dates (inclusive of start, exclusive of end).
   */
  countBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current < end) {
      if (this.isBusinessDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * NSA GFE delivery deadline: 3 business days before the scheduled service date.
   * If the service is scheduled less than 3 business days away, the GFE must be
   * delivered no later than 1 day after scheduling (same-day for walk-ins).
   */
  calculateGfeDeliveryDeadline(scheduledDate: Date, scheduledAt?: Date): Date {
    const serviceDate = new Date(scheduledDate);
    serviceDate.setHours(0, 0, 0, 0);

    const bookingDate = scheduledAt ? new Date(scheduledAt) : new Date();
    bookingDate.setHours(0, 0, 0, 0);

    const businessDaysUntilService = this.countBusinessDays(bookingDate, serviceDate);

    if (businessDaysUntilService >= 3) {
      // Standard: 3 business days before service
      return this.subtractBusinessDays(serviceDate, 3);
    } else {
      // Short notice: 1 business day after scheduling
      return this.addBusinessDays(bookingDate, 1);
    }
  }

  /**
   * Checks if a GFE was delivered on time (before or on the delivery deadline).
   */
  isDeliveredOnTime(deliveredAt: Date, deliveryDeadline: Date): boolean {
    return deliveredAt <= deliveryDeadline;
  }

  /**
   * IDR Open Negotiation deadline: 30 business days from the date the payer
   * sends the initial payment determination.
   */
  calculateOpenNegotiationDeadline(determinationDate: Date): Date {
    return this.addBusinessDays(determinationDate, 30);
  }

  /**
   * IDR Initiation deadline: 4 business days after the open negotiation period ends
   * (i.e., 4 business days after the 30-business-day open negotiation window closes).
   */
  calculateIdrInitiationDeadline(openNegotiationEndDate: Date): Date {
    return this.addBusinessDays(openNegotiationEndDate, 4);
  }

  /**
   * IDR Submission deadline: 10 business days after IDR is initiated.
   */
  calculateIdrSubmissionDeadline(idrInitiationDate: Date): Date {
    return this.addBusinessDays(idrInitiationDate, 10);
  }
}
