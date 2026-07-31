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

/**
 * Saved-report state for the dashboard and the report screen.
 *
 * Screens never touch `reportsRepository` directly — same reason
 * `RecordingScreen` never touches the speech vendor. Swapping the storage
 * backend stops at this file.
 */

/**
 * Migrations run on the first store call that needs the database. Doing it
 * here rather than in `App.jsx` keeps the failure attached to the operation that
 * surfaces it, so the dashboard can show a real error instead of an empty list.
 */
function ensureSchema() {
  runMigrations();
}

const useReportsStore = create((set, get) => ({
  reports: [],
  loading: false,
  /** Distinguishes "not loaded yet" from "loaded, and there are none". */
  loaded: false,
  error: '',

  /** Load every saved report, newest first. */
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

  /** Full report including transcript and both value sets. */
  fetchReport: async id => {
    ensureSchema();
    return getReport(id);
  },

  /**
   * Persist a new report.
   * @returns {Promise<string>} the new id, which the report screen keeps so
   *          the next save updates instead of inserting a duplicate.
   */
  saveNew: async ({ transcript, extracted, edited }) => {
    ensureSchema();
    const id = await createReport({ transcript, extracted, edited });
    await get().loadAll();
    return id;
  },

  /** Persist edits to an already-saved report. */
  saveExisting: async (id, { edited, status }) => {
    ensureSchema();
    await updateReport(id, { edited, status });
    await get().loadAll();
  },

  /** Lock a report as final. It stays openable and editable afterwards. */
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
