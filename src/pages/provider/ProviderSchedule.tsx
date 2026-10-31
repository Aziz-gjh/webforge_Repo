import { useAuth, useIsProvider } from '../../lib/auth';
import { cancelBooking, markCompleted, watchBookingsForDate } from '../../lib/bookings';
import { useApp } from '../../i18n';
import ProviderScheduleView from './ProviderScheduleView';

const data = { cancelBooking, markCompleted, watchBookingsForDate };

export default function ProviderSchedule() {
  const { lang } = useApp();
  const { user, loading: authLoading } = useAuth();
  const { isProvider, loading: providerLoading } = useIsProvider();
  return <ProviderScheduleView user={user} authLoading={authLoading}
    isProvider={isProvider} providerLoading={providerLoading} data={data} lang={lang} />;
}
