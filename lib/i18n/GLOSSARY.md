# Persian glossary (واژه‌نامه)

The vocabulary the Persian interface uses, so every screen says the same thing the same way. It starts from the
terms the team already used in the analytics screens (`lib/analytics/labels.js`). Add a row before introducing a new
term; change a row only together with every string that uses it.

## Writing rules

- **Short and natural**, the way a native product writer would say it to a colleague. No literal translations.
- **Action labels start with the verb (noun form):** «ذخیرهٔ تغییرات»، «ساخت تسک»، «افزودن عضو»، «تأیید و اعمال». Single
  verbs stay single: «حذف»، «ویرایش»، «انصراف».
- **ZWNJ (نیم‌فاصله)** in plurals and compounds: تسک‌ها، شیفت‌لاگ‌ها، می‌شود، نمی‌توانید، به‌روزرسانی، جست‌وجو، تکمیل‌شده.
- **Ezafe after «ه»** is written «هٔ»: «ذخیرهٔ تغییرات»، «برنامهٔ شیفت».
- **Persian punctuation:** «،» «؛» «؟» and guillemets «…» for quoted names. No exclamation marks.
- **Digits:** Persian digits in text (the formatter does it); IDs, ticket numbers, IPs, hashes and references stay Latin
  and left-to-right (`T-1001`, `INC-2026-4471`).
- **Acronyms and product names stay as the team writes them:** SOC، IOC، MISP، Splunk، Grafana، EDR، VPN، AD، Excel، CSV،
  PNG، PDF، L1/L2/L3. The messenger Bale is written «بله».
- **No capitals or tracking** in Persian; overlines become ordinary small labels.
- **Polite but direct:** second person plural without «لطفاً» unless asking for something unusual.

## Terms

| English | Persian | Note |
|---|---|---|
| Task | تسک | plural تسک‌ها |
| Shift Log | شیفت‌لاگ | the analyst's daily log |
| Shift | شیفت | |
| Shift schedule | برنامهٔ شیفت | the calendar page is «تقویم شیفت» |
| Shift change / swap | تغییر شیفت / جابه‌جایی شیفت | |
| Log corrections | اصلاح شیفت‌لاگ | managers only |
| Log checklists | چک‌لیست‌های شیفت‌لاگ | |
| Checklist (task) | چک‌لیست | |
| Analyst | تحلیلگر | |
| Engineer | مهندس | |
| SOC Manager | مدیر SOC | |
| Security Manager | مدیر امنیت | |
| Member | عضو | plural اعضا |
| Team | تیم | |
| Security Department | واحد امنیت | |
| Design & Automation | طراحی و اتوماسیون | |
| Threat Intelligence | هوش تهدید | |
| Dashboard | داشبورد | |
| Insights (section) | آمار و گزارش | «بینش» is reserved for automatic insights |
| Automatic insights | بینش‌های خودکار | |
| Overview | نمای کلی | |
| My stats | آمار من | |
| Person profile | پروفایل کارشناس | «کارشناس» = expert in analytics tables |
| Compare | مقایسه | |
| Trends | روندها | |
| SOC operations | عملیات SOC | |
| Alerts | هشدارها | levels: بحرانی، نیازمند توجه، اطلاع |
| Executive report | گزارش مدیریتی | |
| Reports & exports | گزارش‌ها و خروجی‌ها | |
| Export | خروجی | Excel/CSV/PNG stay Latin |
| Period | بازه | |
| Comparison period | دورهٔ مقایسه | |
| Deadline | ددلاین | team vocabulary (analytics) |
| Overdue | معوق | «۳ روز تأخیر» for the amount |
| Blocked | مسدود | |
| Review / reviewer | بازبینی / بازبین | |
| Approve | تأیید | approve with quality: «تأیید با کیفیت» |
| Return for changes | برگرداندن برای اصلاح | status: «برگشتی» |
| Reopen | بازگشایی | |
| Start | شروع | |
| Submit for review | ارسال برای بازبینی | |
| Resume | ادامهٔ کار | |
| Cancel task | لغو تسک | status: «لغوشده» |
| Backlog | بک‌لاگ | |
| To Do | برای انجام | |
| In Progress | در حال انجام | |
| Done | انجام‌شده | |
| Priority | اولویت | کم، عادی، بالا، بحرانی |
| Complexity | پیچیدگی | ساده، متوسط، پیچیده، پیشرفته |
| Quality | کیفیت | عالی، خوب، قابل قبول، نیازمند بهبود |
| Weighted workload | حجم کار وزن‌دار | |
| On-time delivery | تحویل به‌موقع | |
| Cycle time (median) | میانهٔ زمان انجام | |
| Open queue | صف کار باز | |
| Routine completion | انجام روتین | |
| Ticket | تیکت | count only |
| Issue (monitoring) | مشکل | «گزارش مشکل» for the action; analytics keeps «Issue» as a metric name |
| Traffic report | گزارش ترافیک | |
| Notifications | اعلان‌ها | |
| Mention | اشاره | «@سارا رحیمی به شما اشاره کرد» |
| Search | جست‌وجو | |
| Filter | فیلتر | |
| Saved view | نمای ذخیره‌شده | |
| Side peek | پیش‌نمایش کناری | |
| Board / table | بورد / جدول | |
| Bulk actions | اقدام گروهی | |
| Undo | برگرداندن | |
| Preferences | ترجیحات | under «حساب کاربری» |
| Language | زبان | فارسی / English (each in its own language) |
| Density | تراکم نمایش | راحت / فشرده |
| Theme | تم | روز، گرافیت، مشکی و طلایی، نیمه‌شب |
| Sign in / out | ورود / خروج | |
| Account | حساب کاربری | |
| Administration | مدیریت سیستم | |
| Demo data | دادهٔ نمایشی | always labelled as fictional |
| Today | امروز | |
| Morning / Until 20:00 / Night | صبح / تا ساعت ۲۰ / شب | short: صبح، تا ۲۰، شب |
