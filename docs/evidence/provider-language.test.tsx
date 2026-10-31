// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../../src/components/Layout';
import { I18N } from '../../src/content';
import { AppStateProvider } from '../../src/i18n';
import ProviderSchedule from '../../src/pages/provider/ProviderSchedule';
import type { Booking } from '../../src/types';

const mocks = vi.hoisted(() => ({
  user: { uid: 'provider', name: 'Provider', email: 'provider@example.com' } as { uid: string; name: string; email: string } | null,
  isProvider: true, watch: vi.fn(), cancel: vi.fn(), complete: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('../../src/lib/auth', () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
  useIsProvider: () => ({ isProvider: mocks.isProvider, loading: false }),
  signOutUser: vi.fn(),
}));
vi.mock('../../src/lib/bookings', () => ({
  watchBookingsForDate: mocks.watch, cancelBooking: mocks.cancel, markCompleted: mocks.complete,
}));
vi.mock('../../src/lib/schedule', () => ({ riyadhToday: () => '2026-11-01' }));

const booking: Booking = {
  id: 'booking-a', customerId: 'customer-a', customerName: 'Customer One', customerEmail: 'customer@example.com',
  siteId: 'hegra', siteName: 'Hegra', tripLength: 2, date: '2026-11-01', startHour: 10,
  startAt: new Date('2026-11-01T07:00:00Z'), slotKeys: ['2026-11-01T10', '2026-11-01T11'],
  partySize: 4, status: 'confirmed', createdAt: new Date('2026-10-31T07:00:00Z'),
  updatedAt: new Date('2026-10-31T07:00:00Z'), reminderSentFor: null,
};

function renderPage() {
  return render(<MemoryRouter><AppStateProvider><Header /><ProviderSchedule /></AppStateProvider></MemoryRouter>);
}
function switchLanguage(from: 'en' | 'ar') {
  fireEvent.click(screen.getByRole('button', { name: I18N[from]['switch.langLabel'] }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); localStorage.setItem('rihlatna-lang', 'en');
  mocks.user = { uid: 'provider', name: 'Provider', email: 'provider@example.com' };
  mocks.isProvider = true;
  mocks.watch.mockReset().mockImplementation((_date: string, callback: (rows: Booking[]) => void) => {
    callback([booking,
      { ...booking, id: 'old', siteId: 'old-town', siteName: 'AlUla Old Town' },
      { ...booking, id: 'harrat', siteId: 'harrat-viewpoint', siteName: 'Harrat Viewpoint' },
    ]);
    return mocks.unsubscribe;
  });
  mocks.cancel.mockReset().mockResolvedValue(undefined);
  mocks.complete.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('Provider page follows the app language switch', () => {
  it('switches labels, names, Gregorian dates and details while preserving filters and selection', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Site'), 'hegra');
    await userEvent.click(screen.getByRole('button', { name: /View details for Hegra/ }));
    switchLanguage('en');

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'يومك بلمحة.' })).toBeTruthy();
    expect(main.getAttribute('dir')).toBe('rtl');
    expect(main.getAttribute('lang')).toBe('ar');
    expect((screen.getByLabelText('الموقع') as HTMLSelectElement).value).toBe('hegra');
    expect(screen.getByLabelText('التاريخ').getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('option', { name: 'البلدة القديمة بالعلا' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'مطل حرة عويرض' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /إخفاء التفاصيل لحجز الحِجر/ })).toBeTruthy();
    const details = document.getElementById('provider-booking-details')!;
    expect(details.textContent).toContain('نوفمبر');
    expect(details.textContent).toContain('2026');
    expect(details.textContent).toContain('لم يتم الإرسال للموعد الحالي');
    expect(details.textContent).not.toContain('Nov');
    expect(within(details).getByText('10:00–12:00').getAttribute('dir')).toBe('ltr');
    expect(mocks.watch).toHaveBeenCalledTimes(1);

    switchLanguage('ar');
    expect(screen.getByRole('heading', { name: 'Your day, at a glance.' })).toBeTruthy();
    expect(main.getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('button', { name: /Hide details for Hegra/ })).toBeTruthy();
    expect(mocks.watch).toHaveBeenCalledTimes(1);
  });

  it('updates an open confirmation and its existing error when the language changes', async () => {
    mocks.cancel.mockRejectedValue({ code: 'network' });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /View details for Hegra/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    switchLanguage('en');
    const dialog = screen.getByRole('dialog', { name: 'إلغاء هذا الحجز؟' });
    expect(within(dialog).getByRole('button', { name: 'الاحتفاظ بالحجز' })).toBeTruthy();
    expect(dialog.textContent).toContain('نوفمبر');
    await userEvent.click(within(dialog).getByRole('button', { name: 'إلغاء الحجز' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('انقطع الاتصال');
    switchLanguage('ar');
    expect(within(dialog).getByRole('alert').textContent).toContain('Connection lost');
    expect(within(dialog).getByRole('button', { name: 'Keep Booking' })).toBeTruthy();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });

  it('translates a success message already on screen without repeating the action', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /View details for Hegra/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark Completed' }));
    expect(screen.getByRole('status').textContent).toBe('Booking marked Completed.');
    switchLanguage('en');
    expect(screen.getByRole('status').textContent).toBe('تم تحديد الحجز كمكتمل.');
    expect(screen.getByRole('button', { name: /إخفاء التفاصيل لحجز الحِجر/ })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'الحجوزات' })).getByText('مكتمل')).toBeTruthy();
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });

  it('translates loading, timeout and Retry without restarting the subscription', () => {
    vi.useFakeTimers();
    mocks.watch.mockImplementation(() => mocks.unsubscribe);
    renderPage();
    switchLanguage('en');
    expect(screen.getByRole('status').textContent).toBe('جارٍ تحميل الجدول…');
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(screen.getByRole('alert').textContent).toContain('تعذّر تحميل الجدول');
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeTruthy();
    switchLanguage('ar');
    expect(screen.getByRole('alert').textContent).toContain('The Schedule did not load');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(mocks.watch).toHaveBeenCalledTimes(1);
  });

  it('translates access denial and sign-in without reading any Bookings', () => {
    mocks.user = null; mocks.isProvider = false;
    renderPage();
    switchLanguage('en');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'غير مصرّح' })).toBeTruthy();
    expect(within(main).getByRole('link', { name: 'تسجيل الدخول بحساب Google' })).toBeTruthy();
    expect(mocks.watch).not.toHaveBeenCalled();
  });

  it('translates empty and invalid-date states', () => {
    mocks.watch.mockImplementation((_date: string, callback: (rows: Booking[]) => void) => {
      callback([]); return mocks.unsubscribe;
    });
    renderPage();
    switchLanguage('en');
    expect(screen.getByRole('heading', { name: 'لا توجد حجوزات في هذا اليوم.' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('التاريخ'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toBe('اختر تاريخًا صالحًا لعرض الجدول.');
  });
});
