import { test, expect, Page } from '@playwright/test';

// Upload a sample epub or pdf
async function uploadFile(page: Page, filePath: string) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Drop your file here, or click to select').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

test.describe('Document Upload and Display', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('http://localhost:3003');

    // Click the "done" button to dismiss the welcome message
    await page.getByText('Done').click();
  });

  test.describe('PDF handling', () => {
    test('should upload a PDF document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, './public/sample.pdf');

      // Verify upload success
      await expect(page.getByText('sample.pdf')).toBeVisible();
    });

    test('should display a PDF document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, './public/sample.pdf');

      // Click on the uploaded document
      await page.getByText('sample.pdf').click();

      // Verify PDF viewer is displayed
      await expect(page.locator('.react-pdf__Document')).toBeVisible();
      await expect(page.locator('.react-pdf__Page')).toBeVisible();
    });
  });

  test.describe('EPUB handling', () => {
    test('should upload and display EPUB document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, './public/sample.epub');
      
      // Verify upload success
      await expect(page.getByText('sample.epub')).toBeVisible();
    });

    test('should display an EPUB document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, './public/sample.epub');

      // Click on the uploaded document
      await page.getByText('sample.epub').click();

      // Verify EPUB viewer is displayed
      await expect(page.locator('.epub-container')).toBeVisible();
    });
  });
});
