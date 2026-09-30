import Link from "next/link";
import { redirect } from "next/navigation";
import ShiftLog from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { getShiftSchedule } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!isShiftAnalyst(user)) redirect("/dashboard");
  if (!getShiftSchedule(user.id)) {
    return (
      <div className="page mid shift-page">
        <div className="page-head">
          <div><h1>Shift Log</h1><p>فعالیت‌های روزانه بر اساس برنامه شیفت شما نمایش داده می‌شوند.</p></div>
        </div>
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>امروز شیفتی برای شما ثبت نشده است</h2>
          <p className="muted" style={{ marginBottom: 18 }}>بعد از ثبت شیفت امروز، Shift Log متناسب با نوع شیفت به‌صورت خودکار فعال می‌شود.</p>
          <Link className="btn btn-primary" href="/shift/schedule">مشاهده تقویم شیفت</Link>
        </div>
      </div>
    );
  }
  return <ShiftLog />;
}
