import { PLACES, type Lang } from '../../content';

const en = {
  eyebrow: 'PROVIDER // SCHEDULE',
  title: 'Your day, at a glance.',
  subtitle: 'Every Site. One Schedule. All times in Riyadh',
  live: 'Live Schedule', sample: 'Sample Schedule',
  connectionUnavailable: 'Connection unavailable', connecting: 'Connecting…',
  filters: 'Schedule filters', date: 'Date', site: 'Site', allSites: 'All Sites',
  bookingStatus: 'Booking Status', allStatuses: 'All statuses',
  confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed',
  checkingAccess: 'Checking Provider access…', notAuthorised: 'Not authorised',
  accessDescription: 'The Provider Schedule is available to the Provider account.',
  signIn: 'Sign in with Google', invalidDate: 'Choose a valid date to view the Schedule.',
  loading: 'Loading the Schedule…',
  loadError: 'The Schedule did not load. Check your connection and Provider access, then retry.',
  permissionError: 'Your Provider access could not be verified. Sign in again.',
  networkError: 'Connection lost. Check your connection and try again.',
  tooLateError: 'This Booking can no longer be changed.',
  requestError: 'The request could not be completed. Try again.',
  retry: 'Retry', bookingOne: '{count} Booking', bookingMany: '{count} Bookings',
  emptyDay: 'No Bookings on this day.', emptyFilters: 'No Bookings match these filters.',
  chooseDate: 'Choose another date to view the Schedule.', chooseFilters: 'Choose another Site or Booking Status.',
  bookings: 'Bookings', hourUnit: 'h', partySize: 'Party Size',
  viewDetails: 'View details', hideDetails: 'Hide details',
  detailsLabel: '{action} for {site} at {time}',
  detailsEyebrow: 'BOOKING // DETAILS', customer: 'Customer', email: 'Email',
  dateAndTime: 'Date and time', riyadh: 'Riyadh', created: 'Created', updated: 'Updated',
  reminder: 'Reminder', reminderSent: 'Sent for the current start time',
  reminderNotSent: 'Not sent for the current start time', unavailable: 'Unavailable',
  cancelTitle: 'Cancel this Booking?', cancelDescription: 'The Slots will become open for other Customers.',
  keepBooking: 'Keep Booking', cancelBooking: 'Cancel Booking', cancelling: 'Cancelling…',
  saving: 'Saving…', markCompleted: 'Mark Completed',
  cancelSuccess: 'Booking cancelled. Its Slots are open again.', completedSuccess: 'Booking marked Completed.',
};

export type ProviderTextKey = keyof typeof en;

const ar: Record<ProviderTextKey, string> = {
  eyebrow: 'المزوّد // الجدول',
  title: 'يومك بلمحة.',
  subtitle: 'كل المواقع، جدول واحد. جميع الأوقات بتوقيت الرياض',
  live: 'الجدول المباشر', sample: 'جدول تجريبي',
  connectionUnavailable: 'الاتصال غير متاح', connecting: 'جارٍ الاتصال…',
  filters: 'تصفية الجدول', date: 'التاريخ', site: 'الموقع', allSites: 'جميع المواقع',
  bookingStatus: 'حالة الحجز', allStatuses: 'جميع الحالات',
  confirmed: 'مؤكد', cancelled: 'ملغي', completed: 'مكتمل',
  checkingAccess: 'جارٍ التحقق من صلاحية المزوّد…', notAuthorised: 'غير مصرّح',
  accessDescription: 'جدول المزوّد متاح لحساب المزوّد فقط.',
  signIn: 'تسجيل الدخول بحساب Google', invalidDate: 'اختر تاريخًا صالحًا لعرض الجدول.',
  loading: 'جارٍ تحميل الجدول…',
  loadError: 'تعذّر تحميل الجدول. تحقّق من الاتصال وصلاحية المزوّد ثم أعد المحاولة.',
  permissionError: 'تعذّر التحقق من صلاحية المزوّد. سجّل الدخول مرة أخرى.',
  networkError: 'انقطع الاتصال. تحقّق من اتصالك وحاول مرة أخرى.',
  tooLateError: 'لم يعد بالإمكان تعديل هذا الحجز.',
  requestError: 'تعذّر إتمام الطلب. حاول مرة أخرى.',
  retry: 'إعادة المحاولة', bookingOne: 'عدد الحجوزات: {count}', bookingMany: 'عدد الحجوزات: {count}',
  emptyDay: 'لا توجد حجوزات في هذا اليوم.', emptyFilters: 'لا توجد حجوزات تطابق خيارات التصفية.',
  chooseDate: 'اختر تاريخًا آخر لعرض الجدول.', chooseFilters: 'اختر موقعًا أو حالة حجز أخرى.',
  bookings: 'الحجوزات', hourUnit: 'س', partySize: 'عدد الأشخاص',
  viewDetails: 'عرض التفاصيل', hideDetails: 'إخفاء التفاصيل',
  detailsLabel: '{action} لحجز {site} في {time}',
  detailsEyebrow: 'الحجز // التفاصيل', customer: 'العميل', email: 'البريد الإلكتروني',
  dateAndTime: 'التاريخ والوقت', riyadh: 'الرياض', created: 'تاريخ الإنشاء', updated: 'آخر تحديث',
  reminder: 'التذكير', reminderSent: 'تم الإرسال للموعد الحالي',
  reminderNotSent: 'لم يتم الإرسال للموعد الحالي', unavailable: 'غير متاح',
  cancelTitle: 'إلغاء هذا الحجز؟', cancelDescription: 'ستتاح الأوقات لعملاء آخرين.',
  keepBooking: 'الاحتفاظ بالحجز', cancelBooking: 'إلغاء الحجز', cancelling: 'جارٍ الإلغاء…',
  saving: 'جارٍ الحفظ…', markCompleted: 'تحديد كمكتمل',
  cancelSuccess: 'تم إلغاء الحجز. أصبحت أوقاته متاحة مجددًا.', completedSuccess: 'تم تحديد الحجز كمكتمل.',
};

export const providerCopy: Record<Lang, Record<ProviderTextKey, string>> = { en, ar };

export function providerText(lang: Lang, key: ProviderTextKey, values: Record<string, string | number>): string {
  return providerCopy[lang][key].replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
}

// Older Bookings keep these Site IDs even though the current catalogue expanded.
const legacyNames: Record<string, Record<Lang, string>> = {
  'old-town': { en: 'AlUla Old Town', ar: 'البلدة القديمة بالعلا' },
  'harrat-viewpoint': { en: 'Harrat Viewpoint', ar: 'مطل حرة عويرض' },
};

export function providerSiteName(siteId: string, fallback: string, lang: Lang): string {
  return PLACES.find((place) => place.id === siteId)?.[lang].name ?? legacyNames[siteId]?.[lang] ?? fallback;
}

export function providerDateFormatters(lang: Lang) {
  const locale = lang === 'ar' ? 'ar-SA' : 'en-GB';
  const options = { timeZone: 'Asia/Riyadh', calendar: 'gregory', numberingSystem: 'latn' };
  return {
    date: new Intl.DateTimeFormat(locale, { ...options, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    timestamp: new Intl.DateTimeFormat(locale, { ...options, day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  };
}
