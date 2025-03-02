import { test, expect, Page } from '@playwright/test';

const DIR = './public/';

// Upload a sample epub or pdf
async function uploadFile(page: Page, filePath: string) {
  await page.waitForSelector('input[type=file]', { timeout: 10000 });
  await page.setInputFiles('input[type=file]', `${DIR}${filePath}`);
}

async function uploadAndDisplay(page: Page, fileName: string) {
  // Upload the file
  await uploadFile(page, fileName);
  
  // Wait for link with document-link class
  await page.waitForSelector('.document-link', { timeout: 20000 });
  await page.getByText(fileName).click();

  // Wait for the document to load
  if (fileName.endsWith('.pdf')) {
    await page.waitForSelector('.react-pdf__Document', { timeout: 10000 });
  }
  else if (fileName.endsWith('.epub')) {
    await page.waitForSelector('.epub-container', { timeout: 10000 });
  }
}

async function waitAndClickPlay(page: Page) {
  // Wait for play button selector without disabled attribute
  await page.waitForSelector('button[aria-label="Play"]:not([disabled])', { timeout: 20000 });
  // Play the TTS by aria-label play button
  await page.locator('button[aria-label="Play"]').click();

  // Wait for buttons to be disabled
  await Promise.all([
    page.waitForSelector('button[aria-label="Skip forward"][disabled]'),
    page.waitForSelector('button[aria-label="Skip backward"][disabled]'),
  ]);

  // Wait for the TTS to stop processing
  await Promise.all([
    page.waitForSelector('button[aria-label="Skip forward"]:not([disabled])', { timeout: 30000 }),
    page.waitForSelector('button[aria-label="Skip backward"]:not([disabled])', { timeout: 30000 }),
  ]);

  await page.waitForFunction(() => {
    return navigator.mediaSession?.playbackState === 'playing';
  }, { timeout: 30000 })
}

async function playTTSAndWaitForASecond(page: Page, fileName: string) {
  // Upload and display the document
  await uploadAndDisplay(page, fileName);
  // Wait for play button selector without disabled attribute
  await waitAndClickPlay(page);
  // play for 1s
  await page.waitForTimeout(1000);
}

test.describe('Document flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');

    // Click the "done" button to dismiss the welcome message
    await page.getByText('Done').click();
  });

  test.describe('PDF check', () => {
    test('upload a PDF document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, 'sample.pdf');

      // Verify upload success
      await expect(page.getByText('sample.pdf')).toBeVisible({ timeout: 10000 });
    });

    test('display a PDF document', async ({ page }) => {
      // Upload and display the PDF document
      await uploadAndDisplay(page, 'sample.pdf');

      // Verify PDF viewer is displayed
      await expect(page.locator('.react-pdf__Document')).toBeVisible();
      await expect(page.locator('.react-pdf__Page')).toBeVisible();
    });

    test('play and pause TTS for a PDF document (naive)', async ({ page }) => {
      // Play TTS for the PDF document
      await playTTSAndWaitForASecond(page, 'sample.pdf');
      // Click pause to stop playback
      await page.locator('button[aria-label="Pause"]').click();
      // Check for play button to be visible
      await expect(page.locator('button[aria-label="Play"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('EPUB check', () => {
    test('upload a EPUB document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, 'sample.epub');
      // Verify upload success
      await expect(page.getByText('sample.epub')).toBeVisible({ timeout: 10000 });
    });

    test('display an EPUB document', async ({ page }) => {
      // Upload and display the EPUB document
      await uploadAndDisplay(page, 'sample.epub');
      // Verify EPUB viewer is displayed
      await expect(page.locator('.epub-container')).toBeVisible({ timeout: 10000 });
    });

    test('play and pause TTS for an EPUB document (naive)', async ({ page }) => {
      // Play TTS for the EPUB document
      await playTTSAndWaitForASecond(page, 'sample.epub');
      // Click pause to stop playback
      await page.locator('button[aria-label="Pause"]').click();
      // Check for play button to be visible
      await expect(page.locator('button[aria-label="Play"]')).toBeVisible({ timeout: 10000 });
    });
  });
});
