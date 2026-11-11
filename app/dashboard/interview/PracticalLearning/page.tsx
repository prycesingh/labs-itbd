import PracticalLearningPage from "@/components/interview/user/PracticalLearningPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  // `?type=<interviewType>` (set by the dashboard home's Communication Lab
  // links) auto-starts that module instead of showing the module picker.
  const { type } = await searchParams;
  const moduleType = Array.isArray(type) ? type[0] : type;

  return (
    <main className="flex flex-col w-full">
      <PracticalLearningPage moduleType={moduleType} />
    </main>
  );
}
