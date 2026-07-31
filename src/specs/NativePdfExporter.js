/**
 * @flow strict-local
 * @format
 *
 * TurboModule spec for the PDF exporter (SRS §8 "PDF export").
 *
 * Codegen reads this file — see the `codegenConfig` block in package.json —
 * and generates the abstract `NativePdfExporterSpec` class that
 * `PdfExporterModule.kt` implements. Editing the signatures here requires a
 * native rebuild, never just a Metro reload.
 *
 * The document is passed as a JSON string rather than a structured object on
 * purpose: the payload shape is owned by `reportDocument.js` and changes as
 * fields are added, and a string keeps that churn out of the native ABI.
 */

import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Renders the document and returns the absolute path of the written file. */
  +exportReport: (documentJson: string) => Promise<string>;
  /** Opens the system share sheet for an already-written PDF. */
  +shareReport: (path: string) => Promise<boolean>;
}

export default (TurboModuleRegistry.getEnforcing<Spec>('PdfExporter'): Spec);
