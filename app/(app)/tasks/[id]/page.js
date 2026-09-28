import TaskDetail from "@/components/screens/TaskDetail";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: id };
}

export default async function Page({ params }) {
  const { id } = await params;
  return <TaskDetail id={id} />;
}
