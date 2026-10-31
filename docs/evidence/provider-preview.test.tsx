// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProviderPreview from '../../src/pages/provider/ProviderPreview';

// Importing any real data/auth module would fail this suite before rendering.
vi.mock('../../src/lib/firebase', () => { throw new Error('Preview must not initialize Firebase'); });
vi.mock('../../src/lib/auth', () => { throw new Error('Preview must not use real authentication'); });
vi.mock('../../src/lib/bookings', () => { throw new Error('Preview must not use real Booking operations'); });

afterEach(cleanup);

describe('Provider sample preview', () => {
  it('clearly labels sample data and filters it without connecting to Firebase', async () => {
    render(<ProviderPreview />);
    expect(screen.getByText('Provider preview · sample data')).toBeTruthy();
    expect(screen.getByText('Sample Schedule')).toBeTruthy();
    expect(screen.queryByText('Live Schedule')).toBeNull();
    expect(screen.getAllByRole('button', { name: /View details/ })).toHaveLength(4);
    await userEvent.selectOptions(screen.getByLabelText('Site'), 'hegra');
    expect(screen.getAllByRole('button', { name: /View details/ })).toHaveLength(1);
    expect(screen.getByText('Sample Customer 1')).toBeTruthy();
  });

  it('keeps completion and cancellation local and can reset the sample records', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
    render(<ProviderPreview />);
    await userEvent.click(screen.getByRole('button', { name: /View details for Hegra/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark Completed' }));
    expect(screen.getByRole('status').textContent).toContain('Booking marked Completed');
    fireEvent.click(screen.getByRole('button', { name: 'Reset samples' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel Booking' }));
    expect(screen.getByRole('status').textContent).toContain('Booking cancelled');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset samples' }));
    expect(screen.getByRole('button', { name: 'Mark Completed' })).toBeTruthy();
  });
});
