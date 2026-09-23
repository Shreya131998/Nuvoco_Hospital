import "server-only";
import * as s from "./sheets";
import { isSheetsConfigured } from "./sheets-client";
import type { Backend } from "./contract";

export const sheetsBackend: Backend = {
  name: "sheets",
  isConfigured: isSheetsConfigured,
  getReference: s.getReference,
  submitFirstAid: s.submitFirstAid,
  submitAmbulance: s.submitAmbulance,
  saveMedicine: s.saveMedicine,
  getMedicineMonth: s.getMedicineMonth,
  getActivity: s.getActivity,
  getBoxStatus: s.getBoxStatus,
  getMedicineStatus: s.getMedicineStatus,
  getShiftCompliance: s.getShiftCompliance,
  getFailingPoints: s.getFailingPoints,
  getTopRefilledItems: s.getTopRefilledItems,
  getDailyCounts: s.getDailyCounts,
  getMedicineMonthly: s.getMedicineMonthly,
  getExportData: s.getExportData,
};
