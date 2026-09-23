import FirstAidForm from "./FirstAidForm";
import { loadReference } from "@/lib/data/load-reference";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Page() {
  const res = await loadReference();
  if (!res.ok) return <SetupNotice detail={res.detail} />;
  const { boxes, items } = res.ref;
  return <FirstAidForm boxes={boxes} items={items} />;
}
