import { create } from 'zustand';
import { runMigrations } from '../db/database';
import {
  REPORT_STATUS,
  createReport,
  deleteReport,
  getReport,
  listReports,
  setStatus,
  updateReport,
} from '../db/reportsRepository';

function ensureSchema() {
  runMigrations();
}

const useReportsStore = create((set, get) => ({
  reports: [],
  loading: false,
  loaded: false,
  error: '',

  loadAll: async () => {
    set({ loading: true, error: '' });
    try {
      ensureSchema();
      const reports = await listReports();
      set({ reports, loading: false, loaded: true });
    } catch (error) {
      set({
        loading: false,
        loaded: true,
        error: error?.message || 'Could not open the report database.',
      });
    }
  },

  fetchReport: async id => {
    ensureSchema();
    return getReport(id);
  },

  saveNew: async ({ transcript, extracted, edited }) => {
    ensureSchema();
    const id = await createReport({ transcript, extracted, edited });
    await get().loadAll();
    return id;
  },

  saveExisting: async (id, { edited, status }) => {
    ensureSchema();
    await updateReport(id, { edited, status });
    await get().loadAll();
  },

  finalize: async id => {
    ensureSchema();
    await setStatus(id, REPORT_STATUS.FINAL);
    await get().loadAll();
  },

  remove: async id => {
    try {
      ensureSchema();
      await deleteReport(id);
      await get().loadAll();
    } catch (error) {
      set({
        error: error?.message || 'Could not delete the report.',
      });
    }
  },
}));

export default useReportsStore;
