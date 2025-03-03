import { test, expect } from '@playwright/test';
import { uploadFile, uploadAndDisplay, setupTest } from './helpers';

test.describe('Document Upload Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('uploads a PDF document', async ({ page }) => {
    await uploadFile(page, 'sample.pdf');
    await expect(page.getByText('sample.pdf')).toBeVisible({ timeout: 10000 });
  });

  test('uploads an EPUB document', async ({ page }) => {
    await uploadFile(page, 'sample.epub');
    await expect(page.getByText('sample.epub')).toBeVisible({ timeout: 10000 });
  });

  test('displays a PDF document', async ({ page }) => {
    await uploadAndDisplay(page, 'sample.pdf');
    await expect(page.locator('.react-pdf__Document')).toBeVisible();
    await expect(page.locator('.react-pdf__Page')).toBeVisible();
    await expect(page.getByText('Sample PDF')).toBeVisible();
  });

  test('displays an EPUB document', async ({ page }) => {
    await uploadAndDisplay(page, 'sample.epub');
    await expect(page.locator('.epub-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '‹' })).toBeVisible();
    await expect(page.getByRole('button', { name: '›' })).toBeVisible();
  });
});