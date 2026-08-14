import { test, expect } from './fixtures/auth';
import type { E2EState } from '../global.setup';
import { request as apiRequest } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * E2E tests for the Patient Documents tab:
 *   1. Upload a document via the UI (with document type + description)
 *   2. Verify the document appears in the list with correct metadata
 *   3. Verify the document is persisted (survives a page reload)
 *   4. Verify the document is listed via the backend API
 *   5. Delete the document via the UI and verify it is removed
 */

// Helper: create a patient via the backend API for test isolation.
async function createPatientViaApi(
  state: E2EState,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; [key: string]: unknown }> {
  const context = await apiRequest.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const unique = Date.now() + Math.floor(Math.random() * 1000);
    const response = await context.post('/api/v1/patients', {
      headers: { Authorization: `Bearer ${state.token}` },
      data: {
        firstName: 'E2EDoc',
        lastName: `Patient ${unique}`,
        dateOfBirth: '1988-07-22',
        gender: 'female',
        email: `e2e.doc.${unique}@example.com`,
        phone: '(555) 333-4444',
        ...overrides,
      },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Create patient failed (${response.status()}): ${body}`);
    }
    return response.json();
  } finally {
    await context.dispose();
  }
}

// Helper: list documents for a patient via the backend API.
async function listDocumentsViaApi(
  state: E2EState,
  patientId: string,
): Promise<Array<{ id: string; fileName: string; documentType: string; [key: string]: unknown }>> {
  const context = await apiRequest.newContext({ baseURL: 'http://localhost:4000' });
  try {
    const response = await context.get(`/api/v1/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`List documents failed (${response.status()}): ${body}`);
    }
    return response.json();
  } finally {
    await context.dispose();
  }
}

// Helper: create a temporary file to upload.
function createTempFile(name: string, content: string): string {
  const tmpDir = path.join(process.cwd(), 'test-results', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// Expected console errors that should not fail the test
const EXPECTED_ERROR_PATTERNS = [
  /antd:.*deprecated/i,
  /Duplicated key.*used in Menu/i,
  /Static function can not consume context/i,
  /Failed to load resource.*429/i,
  /The `List` component is deprecated/i,
];

test.describe('Patient Documents', () => {
  test('upload, verify persistence, and delete a document', async ({
    authenticatedPage: page,
    e2eState,
  }) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!EXPECTED_ERROR_PATTERNS.some((p) => p.test(text))) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    // ── Setup: create a dedicated patient via the API ─────────────────────
    const patient = await createPatientViaApi(e2eState);
    const patientId = patient.id as string;

    // ── 1. Navigate to the patient detail page and open the Documents tab ─
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText('Back to Patients')).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.waitForTimeout(1000);

    // The Documents tab should be active and show the upload card
    const documentsTab = page.locator('.ant-tabs-tabpane-active');
    await expect(documentsTab).toBeVisible();
    await expect(documentsTab.getByText('Upload Documents')).toBeVisible();

    // Initially the empty state should be visible
    await expect(documentsTab.getByText(/No documents uploaded yet/i)).toBeVisible();

    // ── 2. Select a document type and add a description ───────────────────
    // The document type selector is an antd Select inside the upload card.
    const uploadCard = documentsTab.locator('.ant-card').filter({ hasText: 'Upload Documents' }).first();
    await uploadCard.locator('.ant-select').first().click();
    await page.locator('.ant-select-item-option-content').getByText('Lab Report', { exact: true }).click();

    await uploadCard.getByPlaceholder('e.g. Chest X-ray from 2024-03-15').fill('E2E CBC lab results');

    // ── 3. Upload a file via the Dragger's hidden file input ───────────────
    const tmpFile = createTempFile(`e2e-lab-${Date.now()}.txt`, 'This is a fake lab report for E2E testing.\nCBC results placeholder.\n');
    const fileInput = uploadCard.locator('input[type="file"]');
    await fileInput.setInputFiles(tmpFile);

    // Wait for the upload to complete and the success message to appear
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 30000 });

    // ── 4. Verify the document appears in the list with correct metadata ──
    // The list card should now contain the uploaded file name and the type tag
    const listCard = documentsTab.locator('.ant-card').filter({ hasText: /^Documents \(/ }).first();
    await expect(listCard).toBeVisible({ timeout: 10000 });
    await expect(listCard.getByText('e2e-lab-', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(listCard.getByText('Lab Report', { exact: true })).toBeVisible();
    await expect(listCard.getByText('E2E CBC lab results')).toBeVisible();

    // ── 5. Verify persistence: reload the page and confirm the doc survives ─
    await page.reload();
    await expect(page.getByText('Back to Patients')).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.waitForTimeout(2000);

    const reloadedList = page.locator('.ant-tabs-tabpane-active').locator('.ant-card').filter({ hasText: /^Documents \(/ }).first();
    await expect(reloadedList.getByText('e2e-lab-', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(reloadedList.getByText('Lab Report', { exact: true })).toBeVisible();

    // ── 6. Verify the document is listed via the backend API ───────────────
    const docs = await listDocumentsViaApi(e2eState, patientId);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    const uploadedDoc = docs.find((d) => d.fileName.includes('e2e-lab-'));
    expect(uploadedDoc).toBeTruthy();
    expect(uploadedDoc!.documentType).toBe('lab_report');

    // ── 7. Delete the document via the UI ──────────────────────────────────
    const deleteButton = reloadedList.getByRole('button', { name: /Delete/i }).first();
    await deleteButton.click();

    // Confirm in the modal
    await expect(page.getByText(/Are you sure you want to delete this document/i)).toBeVisible({ timeout: 5000 });
    // Click the "Delete" button inside the modal (the last one matching)
    await page.getByRole('button', { name: /Delete/i }).last().click();

    // Verify the success message and that the document is removed from the list
    await expect(page.getByText(/Document deleted/i)).toBeVisible({ timeout: 10000 });
    await expect(reloadedList.getByText('e2e-lab-', { exact: false })).toBeHidden({ timeout: 10000 });

    // ── 8. Verify deletion via the backend API ─────────────────────────────
    const docsAfterDelete = await listDocumentsViaApi(e2eState, patientId);
    const stillExists = docsAfterDelete.find((d) => d.fileName.includes('e2e-lab-'));
    expect(stillExists).toBeUndefined();

    // ── 9. No unexpected console/page errors ───────────────────────────────
    expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${pageErrors.map((e) => e.message).join('\n')}`).toHaveLength(0);

    // Cleanup the temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  });
});
