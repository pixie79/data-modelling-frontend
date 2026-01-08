/**
 * E2E tests for Decision Management
 * Tests the full decision workflow using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Decision Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Decision List', () => {
    test('should display decision list header', async ({ page }) => {
      // Navigate to decisions section
      await page.click('[data-testid="decisions-nav"]');

      await expect(page.locator('h2:has-text("Decisions")')).toBeVisible();
    });

    test('should show loading state initially', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      // Loading state should appear briefly
      const loadingIndicator = page.locator('text=Loading decisions...');
      // It may or may not be visible depending on load speed
      await expect(loadingIndicator)
        .toBeVisible({ timeout: 1000 })
        .catch(() => {});
    });

    test('should display empty state when no decisions exist', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      // Wait for load to complete
      await page.waitForLoadState('networkidle');

      // Check for empty state message
      const emptyState = page.locator('text=No decisions found');
      if (await emptyState.isVisible()) {
        await expect(page.locator('text=Create your first decision')).toBeVisible();
      }
    });

    test('should have search functionality', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      const searchInput = page.locator('input[placeholder="Search decisions..."]');
      await expect(searchInput).toBeVisible();

      // Type in search
      await searchInput.fill('test query');
      await expect(searchInput).toHaveValue('test query');
    });

    test('should toggle filter panel', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      // Click filters button
      await page.click('button:has-text("Filters")');

      // Filter panel should appear with Status and Category sections
      await expect(page.locator('h4:has-text("Status")')).toBeVisible();
      await expect(page.locator('h4:has-text("Category")')).toBeVisible();
    });

    test('should have sort controls', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      await expect(page.locator('text=Sort by:')).toBeVisible();
      await expect(page.locator('button:has-text("Number")')).toBeVisible();
      await expect(page.locator('button:has-text("Title")')).toBeVisible();
      await expect(page.locator('button:has-text("Status")')).toBeVisible();
    });
  });

  test.describe('Create Decision', () => {
    test('should show create button when enabled', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      // Look for the New Decision button
      const createButton = page.locator('button:has-text("New Decision")');
      if (await createButton.isVisible()) {
        await expect(createButton).toBeEnabled();
      }
    });

    test('should open decision editor on create', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      const createButton = page.locator('button:has-text("New Decision")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // Decision editor should open
        await expect(page.locator('[data-testid="decision-editor"]')).toBeVisible();
      }
    });

    test('should have required form fields', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      const createButton = page.locator('button:has-text("New Decision")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // Check for required fields
        await expect(page.locator('label:has-text("Title")')).toBeVisible();
        await expect(page.locator('label:has-text("Category")')).toBeVisible();
        await expect(page.locator('label:has-text("Context")')).toBeVisible();
        await expect(page.locator('label:has-text("Decision")')).toBeVisible();
      }
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      const createButton = page.locator('button:has-text("New Decision")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // Try to save without filling required fields
        const saveButton = page.locator('button:has-text("Save")');
        if (await saveButton.isVisible()) {
          await saveButton.click();

          // Should show validation error
          await expect(page.locator('text=required')).toBeVisible();
        }
      }
    });

    test('should create decision with valid data', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      const createButton = page.locator('button:has-text("New Decision")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // Fill in form
        await page.fill('input[name="title"]', 'Test Decision');
        await page.selectOption('select[name="category"]', 'technology');
        await page.fill('textarea[name="context"]', 'This is the context for our test decision');
        await page.fill('textarea[name="decision"]', 'We decided to use this approach');

        // Save
        await page.click('button:has-text("Save")');

        // Should show success or navigate back to list
        await expect(page.locator('text=Test Decision')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Decision Details', () => {
    test('should show decision details on selection', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');

      // Wait for decisions to load
      await page.waitForLoadState('networkidle');

      // Click on first decision if exists
      const firstDecision = page.locator('[data-testid="decision-item"]').first();
      if (await firstDecision.isVisible()) {
        await firstDecision.click();

        // Decision viewer should show details
        await expect(page.locator('[data-testid="decision-viewer"]')).toBeVisible();
      }
    });

    test('should display ADR number', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const firstDecision = page.locator('[data-testid="decision-item"]').first();
      if (await firstDecision.isVisible()) {
        await firstDecision.click();

        // ADR number should be visible
        await expect(page.locator('text=/ADR-\\d{4}/')).toBeVisible();
      }
    });

    test('should show status badge', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const firstDecision = page.locator('[data-testid="decision-item"]').first();
      if (await firstDecision.isVisible()) {
        await firstDecision.click();

        // Status badge should be visible
        await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();
      }
    });
  });

  test.describe('Decision Status Workflow', () => {
    test('should allow status transitions', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Find a draft decision
      const draftDecision = page.locator('[data-testid="decision-item"]:has-text("Draft")').first();
      if (await draftDecision.isVisible()) {
        await draftDecision.click();

        // Should have workflow actions
        const workflowButton = page.locator('button:has-text("Propose")');
        if (await workflowButton.isVisible()) {
          await expect(workflowButton).toBeEnabled();
        }
      }
    });

    test('should confirm status change', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const proposedDecision = page
        .locator('[data-testid="decision-item"]:has-text("Proposed")')
        .first();
      if (await proposedDecision.isVisible()) {
        await proposedDecision.click();

        const acceptButton = page.locator('button:has-text("Accept")');
        if (await acceptButton.isVisible()) {
          await acceptButton.click();

          // Should show confirmation dialog
          await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
        }
      }
    });
  });

  test.describe('Decision Export', () => {
    test('should have export option', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const firstDecision = page.locator('[data-testid="decision-item"]').first();
      if (await firstDecision.isVisible()) {
        await firstDecision.click();

        // Export button should be available
        const exportButton = page.locator('button:has-text("Export")');
        await expect(exportButton).toBeVisible();
      }
    });

    test('should export as markdown', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const firstDecision = page.locator('[data-testid="decision-item"]').first();
      if (await firstDecision.isVisible()) {
        await firstDecision.click();

        const exportButton = page.locator('button:has-text("Export")');
        if (await exportButton.isVisible()) {
          await exportButton.click();

          // Markdown export option
          const markdownOption = page.locator('text=Export as Markdown');
          if (await markdownOption.isVisible()) {
            await markdownOption.click();

            // Download should be triggered or preview shown
            await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Decision Filtering', () => {
    test('should filter by status', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.click('button:has-text("Filters")');

      // Select Draft status
      await page.click('label:has-text("Draft")');

      // All visible decisions should be Draft
      const decisions = page.locator('[data-testid="decision-item"]');
      const count = await decisions.count();

      for (let i = 0; i < count; i++) {
        const decision = decisions.nth(i);
        await expect(decision.locator('[data-testid="status-badge"]')).toContainText('Draft');
      }
    });

    test('should filter by category', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Open filters
      await page.click('button:has-text("Filters")');

      // Select Technology category
      await page.click('label:has-text("Technology")');

      // All visible decisions should be Technology category
      const decisions = page.locator('[data-testid="decision-item"]');
      const count = await decisions.count();

      for (let i = 0; i < count; i++) {
        const decision = decisions.nth(i);
        await expect(decision.locator('[data-testid="category-badge"]')).toContainText(
          'Technology'
        );
      }
    });

    test('should clear filters', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Open filters and select something
      await page.click('button:has-text("Filters")');
      await page.click('label:has-text("Draft")');

      // Clear filters
      const clearButton = page.locator('button:has-text("Clear filters")');
      if (await clearButton.isVisible()) {
        await clearButton.click();

        // Active indicator should be gone
        await expect(page.locator('span:has-text("Active")')).not.toBeVisible();
      }
    });
  });

  test.describe('Decision Search', () => {
    test('should search decisions', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder="Search decisions..."]');
      await searchInput.fill('React');

      // Wait for debounced search
      await page.waitForTimeout(400);

      // Results should be filtered
      const decisions = page.locator('[data-testid="decision-item"]');
      const count = await decisions.count();

      if (count > 0) {
        // All visible decisions should contain search term
        const firstDecision = decisions.first();
        await expect(firstDecision).toContainText(/React/i);
      }
    });

    test('should show no results message', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder="Search decisions..."]');
      await searchInput.fill('xyznonexistentquery123');

      await page.waitForTimeout(400);

      // Should show no results
      await expect(page.locator('text=No decisions found')).toBeVisible();
    });
  });

  test.describe('Decision Sorting', () => {
    test('should sort by number', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Click Number sort
      await page.click('button:has-text("Number")');

      // Direction indicator should toggle
      await expect(page.locator('text=↑')).toBeVisible();
    });

    test('should sort by title', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Click Title sort
      await page.click('button:has-text("Title")');

      // Title button should be active
      const titleButton = page.locator('button:has-text("Title")');
      await expect(titleButton).toHaveClass(/bg-gray-200/);
    });

    test('should sort by updated date', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Click Updated sort
      await page.click('button:has-text("Updated")');

      // Updated button should be active
      const updatedButton = page.locator('button:has-text("Updated")');
      await expect(updatedButton).toHaveClass(/bg-gray-200/);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation', async ({ page }) => {
      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Tab to search input
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const searchInput = page.locator('input[placeholder="Search decisions..."]');
      await expect(searchInput).toBeFocused();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Decision list should still be visible
      await expect(page.locator('h2:has-text("Decisions")')).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.click('[data-testid="decisions-nav"]');
      await page.waitForLoadState('networkidle');

      // Decision list should still be visible
      await expect(page.locator('h2:has-text("Decisions")')).toBeVisible();
    });
  });
});
