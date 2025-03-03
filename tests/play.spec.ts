import { test, expect } from '@playwright/test';
import { setupTest, playTTSAndWaitForASecond } from './helpers';

test.describe('Play/Pause Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test.describe.configure({ mode: 'serial' });

  test('plays and pauses TTS for a PDF document', async ({ page }) => {
    // Play TTS for the PDF document
    await playTTSAndWaitForASecond(page, 'sample.pdf');
    
    // Click pause to stop playback
    await page.getByRole('button', { name: 'Pause' }).click();
    
    // Check for play button to be visible
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10000 });
  });

  test('plays and pauses TTS for an EPUB document', async ({ page }) => {
    // Play TTS for the EPUB document
    await playTTSAndWaitForASecond(page, 'sample.epub');
    
    // Click pause to stop playback
    await page.getByRole('button', { name: 'Pause' }).click();
    
    // Check for play button to be visible
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10000 });
  });
});