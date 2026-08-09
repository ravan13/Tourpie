"use client";

import CustomTripRequestForm from "@/components/customTrip/CustomTripRequestForm";
import { useSearchParams } from "next/navigation";

export default function RequestCustomOffersPage() {
  const sp = useSearchParams();
  const editRaw = sp.get("edit");
  const editId = editRaw ? Number(editRaw) : undefined;

  return <CustomTripRequestForm variant="page" editId={editId} redirectAfterSubmit="/dashboard/requests" />;
}
