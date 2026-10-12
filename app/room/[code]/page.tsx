import Table from "@/components/Table";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Table code={code.toUpperCase()} />;
}
