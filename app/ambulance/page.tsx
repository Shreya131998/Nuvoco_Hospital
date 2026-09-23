import AmbulanceForm from "./AmbulanceForm";
import { loadReference } from "@/lib/data/load-reference";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Page() {
  const res = await loadReference();
  if (!res.ok) return <SetupNotice detail={res.detail} />;
  const { vehicles, points } = res.ref;
  return <AmbulanceForm vehicles={vehicles} points={points} />;
}
