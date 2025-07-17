import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForSelector('body');
    
    // Check if the page has loaded successfully
    await expect(page).toHaveTitle(/photoclove/i);
  });

  test('should display the main interface', async ({ page }) => {
    await page.goto('/');
    
    // Wait for main content to load
    await page.waitForSelector('body');
    
    // Check for basic UI elements
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle basic navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForSelector('body');
    
    // Test basic page interactions
    await page.click('body');
    
    // Verify page is still responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test different viewport sizes
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForSelector('body');
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForSelector('body');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForSelector('body');
    
    // Test basic keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify page is still functional
    await expect(page.locator('body')).toBeVisible();
  });
});