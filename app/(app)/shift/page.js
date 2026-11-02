import { cookies } from "next/headers";
import { normalizeLocale } from "@/lib/i18n/messages";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShiftLog from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { getDayStatus, getShiftLog, getShiftSchedule, today } from "@/lib/server/repo";
import { isBackfillAllowed } from "@/lib/server/shift-backfill";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log" };

export default async function Page({ searchParams }) {
  const locale = normalizeLocale((await cookies()).get("so.locale")?.value);
  const user = await getCurrentUser();
  if (!isShiftAnalyst(user)) redirect("/dashboard");
  const params = await searchParams;
  const date = params?.date ? String(params.date) : today();
  if (date !== today() && !isBackfillAllowed(user.id, date)) redirect("/shift/history");
  if (!getShiftSchedule(user.id, date)) {
    const status = getDayStatus(user.id);
    const name = status === "off" ? (locale === "fa" ? "تعطیل شیفت" : "a day off") : status === "leave" ? (locale === "fa" ? "مرخصی" : "leave") : null;
    return (
      <div className="page mid shift-page">
        <div className="page-head">
          <div><h1>{locale === "fa" ? "گزارش شیفت" : "Shift Log"}</h1><p>{locale === "fa" ? "فعالیت‌های روزانه بر اساس برنامه شیفت شما نمایش داده می‌شوند." : "Daily activities are shown according to your shift schedule."}</p></div>
        </div>
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>{locale === "fa" ? (name ? `امروز برای شما «${name}» ثبت شده است` : "امروز شیفتی برای شما ثبت نشده است") : (name ? `Today is recorded as ${name}.` : "No shift is scheduled for you today.")}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>{locale === "fa" ? (name ? "برای روزهای تعطیل شیفت یا مرخصی، شیفت‌لاگ لازم نیست." : "بعد از ثبت شیفت امروز، گزارش متناسب با نوع شیفت به‌صورت خودکار فعال می‌شود.") : (name ? "A shift log is not required for days off or leave." : "When today’s shift is scheduled, the matching shift log will become available automatically.")}</p>
          <Link className="btn btn-primary" href="/shift/schedule">{locale === "fa" ? "مشاهده تقویم شیفت" : "View shift calendar"}</Link>
        </div>
      </div>
    );
  }
  return <ShiftLog key={date} initialLog={getShiftLog(user.id, date)} />;
}
