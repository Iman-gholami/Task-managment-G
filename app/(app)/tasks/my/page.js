import Tasks from "@/components/screens/Tasks";

export const metadata = { title: "My Tasks" };

export default function Page() {
  return <Tasks scope="my" />;
}
