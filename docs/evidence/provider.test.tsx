// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProviderSchedule from '../../src/pages/provider/ProviderSchedule';
import type { Booking } from '../../src/types';

const mocks = vi.hoisted(() => ({
  user: { uid: 'provider', name: 'Provider', email: 'provider@example.com' } as { uid: string; name: string; email: string } | null,
  authLoading: false, providerLoading: false, isProvider: true,
  watch: vi.fn(), cancel: vi.fn(), complete: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('../../src/lib/auth', () => ({
  useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }),
  useIsProvider: () => ({ isProvider: mocks.isProvider, loading: mocks.providerLoading }),
}));
vi.mock('../../src/lib/bookings', () => ({
  watchBookingsForDate: mocks.watch, cancelBooking: mocks.cancel, markCompleted: mocks.complete,
}));
vi.mock('../../src/lib/schedule', () => ({ riyadhToday: () => '2026-11-01' }));

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-a', customerId: 'customer-a', customerName: 'Customer One', customerEmail: 'customer@example.com',
    siteId: 'hegra', siteName: 'Hegra', tripLength: 2, date: '2026-11-01', startHour: 10,
    startAt: new Date('2026-11-01T07:00:00Z'), slotKeys: ['2026-11-01T10', '2026-11-01T11'],
    partySize: 4, status: 'confirmed', createdAt: new Date('2026-10-31T07:00:00Z'),
    updatedAt: new Date('2026-10-31T07:00:00Z'), reminderSentFor: null, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { uid: 'provider', name: 'Provider', email: 'provider@example.com' };
  mocks.authLoading = false; mocks.providerLoading = false; mocks.isProvider = true;
  mocks.watch.mockImplementation((_date: string, callback: (rows: Booking[]) => void) => {
    callback([booking()]); return mocks.unsubscribe;
  });
  mocks.cancel.mockResolvedValue(undefined); mocks.complete.mockResolvedValue(undefined);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Provider Schedule', () => {
  it('does not request or expose Bookings to a Visitor or non-Provider', () => {
    mocks.user = null; mocks.isProvider = false;
    const result = render(<ProviderSchedule />);
    expect(screen.getByRole('heading', { name: 'Not authorised' })).toBeTruthy();
    expect(mocks.watch).not.toHaveBeenCalled();
    expect(screen.queryByText('customer@example.com')).toBeNull();
    mocks.user = { uid: 'customer', name: 'Customer', email: 'customer@example.com' };
    result.rerender(<ProviderSchedule />);
    expect(mocks.watch).not.toHaveBeenCalled();
  });

  it('waits for both authentication and Provider checks', () => {
    mocks.providerLoading = true;
    render(<ProviderSchedule />);
    expect(screen.getByRole('status').textContent).toContain('Checking Provider access');
    expect(mocks.watch).not.toHaveBeenCalled();
  });

  it('shows Customer details, Riyadh times and the Reminder status', async () => {
    render(<ProviderSchedule />);
    expect(mocks.watch).toHaveBeenCalledWith('2026-11-01', expect.any(Function));
    expect(screen.getByText('10:00–12:00')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /View details/ }));
    const details = document.getElementById('provider-booking-details')!;
    expect(details.textContent).toContain('Party Size4');
    expect(details.textContent).toContain('1 Nov 2026');
    expect(details.textContent).toContain('Not sent for the current start time');
    expect(details.textContent).toContain('31 Oct 2026, 10:00');
  });

  it('filters by Site and Booking Status', async () => {
    mocks.watch.mockImplementation((_date: string, callback: (rows: Booking[]) => void) => {
      callback([booking(), booking({ id: 'booking-b', siteId: 'old-town', siteName: 'AlUla Old Town', status: 'completed' })]);
      return mocks.unsubscribe;
    });
    render(<ProviderSchedule />);
    await userEvent.selectOptions(screen.getByLabelText('Site'), 'old-town');
    expect(screen.getAllByRole('button', { name: /View details/ })).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText('Booking Status'), 'confirmed');
    expect(screen.getByRole('heading', { name: 'No Bookings match these filters.' })).toBeTruthy();
  });

  it('requires confirmation to cancel, then announces success', async () => {
    render(<ProviderSchedule />);
    await userEvent.click(screen.getByRole('button', { name: /View details/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    const dialog = screen.getByRole('dialog');
    expect(mocks.cancel).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep Booking' }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel Booking' }));
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith('booking-a');
    expect(screen.getByRole('status').textContent).toContain('Booking cancelled');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prevents duplicate completion requests while one is in progress', async () => {
    let resolve!: () => void;
    mocks.complete.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    render(<ProviderSchedule />);
    await userEvent.click(screen.getByRole('button', { name: /View details/ }));
    const button = screen.getByRole('button', { name: 'Mark Completed' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.complete).toHaveBeenCalledExactlyOnceWith('booking-a');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve());
    expect(screen.getByRole('status').textContent).toContain('Booking marked Completed');
  });

  it('shows a failed cancellation inside the confirmation dialog', async () => {
    mocks.cancel.mockRejectedValue({ code: 'network' });
    render(<ProviderSchedule />);
    await userEvent.click(screen.getByRole('button', { name: /View details/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel Booking' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('Connection lost');
  });

  it('removes previous date records immediately and cleans up the subscription', async () => {
    mocks.watch.mockImplementationOnce((_date: string, callback: (rows: Booking[]) => void) => {
      callback([booking()]); return mocks.unsubscribe;
    }).mockImplementation(() => mocks.unsubscribe);
    const result = render(<ProviderSchedule />);
    expect(screen.getByText('customer@example.com')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-02' } });
    expect(screen.queryByText('customer@example.com')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading the Schedule');
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    result.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('bounds the initial wait and provides Retry when the watcher returns no data', () => {
    vi.useFakeTimers();
    mocks.watch.mockImplementation(() => mocks.unsubscribe);
    render(<ProviderSchedule />);
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(screen.getByRole('alert').textContent).toContain('The Schedule did not load');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.watch).toHaveBeenCalledTimes(2);
  });

  it('shows the empty day state and never queries an empty date', () => {
    mocks.watch.mockImplementation((_date: string, callback: (rows: Booking[]) => void) => {
      callback([]); return mocks.unsubscribe;
    });
    render(<ProviderSchedule />);
    expect(screen.getByRole('heading', { name: 'No Bookings on this day.' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toContain('Choose a valid date');
    expect(mocks.watch).toHaveBeenCalledOnce();
  });
});
