import Person from "@/components/analytics/screens/Person";
import { requirePersonAccess } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Person" };

export default async function Page({ params }) {
  const { id } = await params;
  const person = decodeURIComponent(id);
  await requirePersonAccess(person);
  return <Person id={person} />;
}
