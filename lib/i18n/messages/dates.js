// Calendar words and period labels, read by lib/i18n/format.js and lib/analytics/periods.js. The calendar follows the
// language, so fa names the Jalali months and en the Gregorian ones. Numeric keys: months 1–12, weekdays 0–6 with
// 0 = Saturday (the organisation's week), seasons 1–4 (the Jalali seasons in fa, the quarters in en).
// Families read with a computed key: months, monthsShort, weekdays, weekdaysShort, weekdaysNarrow, seasons, presets,
// comparisons, granularities.
export default {
  fa: {
    months: { 1: "فروردین", 2: "اردیبهشت", 3: "خرداد", 4: "تیر", 5: "مرداد", 6: "شهریور", 7: "مهر", 8: "آبان", 9: "آذر", 10: "دی", 11: "بهمن", 12: "اسفند" },
    monthsShort: { 1: "فروردین", 2: "اردیبهشت", 3: "خرداد", 4: "تیر", 5: "مرداد", 6: "شهریور", 7: "مهر", 8: "آبان", 9: "آذر", 10: "دی", 11: "بهمن", 12: "اسفند" },
    weekdays: { 0: "شنبه", 1: "یکشنبه", 2: "دوشنبه", 3: "سه‌شنبه", 4: "چهارشنبه", 5: "پنجشنبه", 6: "جمعه" },
    weekdaysShort: { 0: "شنبه", 1: "یکشنبه", 2: "دوشنبه", 3: "سه‌شنبه", 4: "چهارشنبه", 5: "پنجشنبه", 6: "جمعه" },
    weekdaysNarrow: { 0: "ش", 1: "ی", 2: "د", 3: "س", 4: "چ", 5: "پ", 6: "ج" },
    seasons: { 1: "بهار", 2: "تابستان", 3: "پاییز", 4: "زمستان" },
    /** Joins the two ends of a range: «۱ تا ۱۴ مهر ۱۴۰۵». */
    rangeTo: "تا",
    relative: {
      justNow: "همین حالا",
    },
    due: {
      none: "بدون ددلاین",
      today: "امروز",
      tomorrow: "فردا",
      overdue: { one: "{count} روز تأخیر", other: "{count} روز تأخیر" },
      inDays: { one: "{count} روز دیگر", other: "{count} روز دیگر" },
    },
    units: {
      hours: "{value} ساعت",
      days: { one: "{value} روز", other: "{value} روز" },
    },
    presets: {
      month: "ماه جاری",
      prevMonth: "ماه گذشته",
      season: "فصل جاری",
      prevSeason: "فصل گذشته",
      year: "سال جاری",
      last7: "۷ روز اخیر",
      last30: "۳۰ روز اخیر",
      last90: "۹۰ روز اخیر",
      last365: "۱۲ ماه اخیر",
      custom: "بازهٔ دلخواه",
    },
    comparisons: {
      prev: "دورهٔ قبل (هم‌اندازه)",
      yoy: "همین بازه در سال قبل",
      none: "بدون مقایسه",
    },
    granularities: {
      auto: "خودکار",
      day: "روزانه",
      week: "هفتگی",
      month: "ماهانه",
      season: "فصلی",
      year: "سالانه",
    },
    period: {
      year: "سال {year}",
      week: "هفتهٔ {date}",
      firstDays: { one: "{count} روز اول {name}", other: "{count} روز اول {name}" },
      daysBefore: { one: "{count} روز قبل از آن", other: "{count} روز قبل از آن" },
      sameLastYear: "همین بازه در سال قبل",
      lastYear: "سال قبل",
      previous: "دورهٔ قبل",
    },
  },
  en: {
    months: { 1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June", 7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December" },
    monthsShort: { 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec" },
    weekdays: { 0: "Saturday", 1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday" },
    weekdaysShort: { 0: "Sat", 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri" },
    weekdaysNarrow: { 0: "S", 1: "S", 2: "M", 3: "T", 4: "W", 5: "T", 6: "F" },
    seasons: { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" },
    /** Joins the two ends of a range: "Oct 1 – 14, 2026". */
    rangeTo: "–",
    relative: {
      justNow: "just now",
    },
    due: {
      none: "No deadline",
      today: "Due today",
      tomorrow: "Due tomorrow",
      overdue: { one: "{count} day overdue", other: "{count} days overdue" },
      inDays: { one: "In {count} day", other: "In {count} days" },
    },
    units: {
      hours: "{value} h",
      days: { one: "{value} day", other: "{value} days" },
    },
    presets: {
      month: "This month",
      prevMonth: "Last month",
      season: "This quarter",
      prevSeason: "Last quarter",
      year: "This year",
      last7: "Last 7 days",
      last30: "Last 30 days",
      last90: "Last 90 days",
      last365: "Last 12 months",
      custom: "Custom range",
    },
    comparisons: {
      prev: "Previous period (same length)",
      yoy: "Same period last year",
      none: "No comparison",
    },
    granularities: {
      auto: "Automatic",
      day: "Daily",
      week: "Weekly",
      month: "Monthly",
      season: "Quarterly",
      year: "Yearly",
    },
    period: {
      year: "{year}",
      week: "Week of {date}",
      firstDays: { one: "First day of {name}", other: "First {count} days of {name}" },
      daysBefore: { one: "The day before", other: "The {count} days before" },
      sameLastYear: "Same period last year",
      lastYear: "Last year",
      previous: "Previous period",
    },
  },
};
