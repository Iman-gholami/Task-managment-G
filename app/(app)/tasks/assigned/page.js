import Tasks from "@/components/screens/Tasks";

export const metadata = { title: "Assigned by Me" };

export default function Page() {
  return <Tasks scope="assigned" />;
}
