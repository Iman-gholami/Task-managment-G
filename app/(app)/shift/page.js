import Link from "next/link";
import { redirect } from "next/navigation";
import ShiftLog from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { getDayStatus, getShiftLog, getShiftSchedule, today } from "@/lib/server/repo";
import { isBackfillAllowed } from "@/lib/server/shift-backfill";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log" };

export default async function Page({ searchParams }) {
  const user = await getCurrentUser();
  if (!isShiftAnalyst(user)) redirect("/dashboard");
  const params = await searchParams;
  const date = params?.date ? String(params.date) : today();
  if (date !== today() && !isBackfillAllowed(user.id, date)) redirect("/shift/history");
  if (!getShiftSchedule(user.id, date)) {
    const status = getDayStatus(user.id);
    const name = status === "off" ? "تعطیل شیفت" : status === "leave" ? "مرخصی" : null;
    return (
      <div className="page mid shift-page">
        <div className="page-head">
          <div><h1>Shift Log</h1><p>فعالیت‌های روزانه بر اساس برنامه شیفت شما نمایش داده می‌شوند.</p></div>
        </div>
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>{name ? `امروز برای شما «${name}» ثبت شده است` : "امروز شیفتی برای شما ثبت نشده است"}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>{name ? "برای روزهای تعطیل شیفت یا مرخصی، شیفت‌لاگ لازم نیست." : "بعد از ثبت شیفت امروز، Shift Log متناسب با نوع شیفت به‌صورت خودکار فعال می‌شود."}</p>
          <Link className="btn btn-primary" href="/shift/schedule">مشاهده تقویم شیفت</Link>
        </div>
      </div>
    );
  }
  return <ShiftLog key={date} initialLog={getShiftLog(user.id, date)} />;
}
