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
  const size = fileName.endsWith('.pdf') ? '0.02 MB' : '0.33 MB';
  await page.getByRole('link', { name: `${fileName} ${size}` }).click();

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
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  // Play the TTS by clicking the button
  await page.getByRole('button', { name: 'Play' }).click();

  // Expect for buttons to be disabled
  await expect(page.locator('button[aria-label="Skip forward"][disabled]')).toBeVisible();
  await expect(page.locator('button[aria-label="Skip backward"][disabled]')).toBeVisible();

  // Wait for the TTS to stop processing
  await Promise.all([
    page.waitForSelector('button[aria-label="Skip forward"]:not([disabled])', { timeout: 45000 }),
    page.waitForSelector('button[aria-label="Skip backward"]:not([disabled])', { timeout: 45000 }),
  ]);

  await page.waitForFunction(() => {
    return navigator.mediaSession?.playbackState === 'playing';
  });
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
    await page.waitForLoadState('networkidle');

    // Click the "done" button to dismiss the welcome message
    await page.getByText('Done').click();
  });

  // Basic upload tests can run in parallel
  test.describe('Basic document tests', () => {
    test('upload a PDF document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, 'sample.pdf');

      // Verify upload success
      await expect(page.getByText('sample.pdf')).toBeVisible({ timeout: 10000 });
    });

    test('upload a EPUB document', async ({ page }) => {
      // Upload the file
      await uploadFile(page, 'sample.epub');
      // Verify upload success
      await expect(page.getByText('sample.epub')).toBeVisible({ timeout: 10000 });
    });

    test('display a PDF document', async ({ page }) => {
      // Upload and display the PDF document
      await uploadAndDisplay(page, 'sample.pdf');

      // Verify PDF viewer is displayed
      await expect(page.locator('.react-pdf__Document')).toBeVisible();
      await expect(page.locator('.react-pdf__Page')).toBeVisible();
      await expect(page.getByText('Sample PDF')).toBeVisible();
    });

    test('display an EPUB document', async ({ page }) => {
      // Upload and display the EPUB document
      await uploadAndDisplay(page, 'sample.epub');
      // Verify EPUB viewer is displayed
      await expect(page.locator('.epub-container')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: '‹' })).toBeVisible();
      await expect(page.getByRole('button', { name: '›' })).toBeVisible();
    });
  });

  // TTS tests run with limited concurrency
  test.describe('TTS functionality', () => {
    test.describe.configure({ mode: 'serial' });
    test('play and pause TTS for a PDF document', async ({ page }) => {
      // Play TTS for the PDF document
      await playTTSAndWaitForASecond(page, 'sample.pdf');
      // Click pause to stop playback
      await page.getByRole('button', { name: 'Pause' }).click();
      // Check for play button to be visible
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10000 });
    });

    test('play and pause TTS for an EPUB document', async ({ page }) => {
      // Play TTS for the EPUB document
      await playTTSAndWaitForASecond(page, 'sample.epub');
      // Click pause to stop playback
      await page.getByRole('button', { name: 'Pause' }).click();
      // Check for play button to be visible
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10000 });
    });
  });
});
