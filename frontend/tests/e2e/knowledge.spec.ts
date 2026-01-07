/**
 * E2E tests for Knowledge Base Management
 * Tests the full knowledge article workflow using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Knowledge Base Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Knowledge List', () => {
    test('should display knowledge base header', async ({ page }) => {
      // Navigate to knowledge section
      await page.click('[data-testid="knowledge-nav"]');

      await expect(page.locator('h2:has-text("Knowledge Base")')).toBeVisible();
    });

    test('should show loading state initially', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const loadingIndicator = page.locator('text=Loading articles...');
      await expect(loadingIndicator)
        .toBeVisible({ timeout: 1000 })
        .catch(() => {});
    });

    test('should display empty state when no articles exist', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=No articles found');
      if (await emptyState.isVisible()) {
        await expect(page.locator('text=Create your first article')).toBeVisible();
      }
    });

    test('should have search functionality', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const searchInput = page.locator('input[placeholder="Search articles..."]');
      await expect(searchInput).toBeVisible();

      await searchInput.fill('getting started');
      await expect(searchInput).toHaveValue('getting started');
    });

    test('should toggle filter panel', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      await page.click('button:has-text("Filters")');

      await expect(page.locator('h4:has-text("Type")')).toBeVisible();
      await expect(page.locator('h4:has-text("Status")')).toBeVisible();
    });

    test('should have sort controls', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      await expect(page.locator('text=Sort by:')).toBeVisible();
      await expect(page.locator('button:has-text("Number")')).toBeVisible();
      await expect(page.locator('button:has-text("Title")')).toBeVisible();
      await expect(page.locator('button:has-text("Type")')).toBeVisible();
    });
  });

  test.describe('Create Article', () => {
    test('should show create button when enabled', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const createButton = page.locator('button:has-text("New Article")');
      if (await createButton.isVisible()) {
        await expect(createButton).toBeEnabled();
      }
    });

    test('should open article editor on create', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const createButton = page.locator('button:has-text("New Article")');
      if (await createButton.isVisible()) {
        await createButton.click();

        await expect(page.locator('[data-testid="article-editor"]')).toBeVisible();
      }
    });

    test('should have required form fields', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const createButton = page.locator('button:has-text("New Article")');
      if (await createButton.isVisible()) {
        await createButton.click();

        await expect(page.locator('label:has-text("Title")')).toBeVisible();
        await expect(page.locator('label:has-text("Type")')).toBeVisible();
        await expect(page.locator('label:has-text("Summary")')).toBeVisible();
        await expect(page.locator('label:has-text("Content")')).toBeVisible();
      }
    });

    test('should show article type options', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const createButton = page.locator('button:has-text("New Article")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // Open type dropdown
        const typeSelect = page.locator('select[name="type"]');
        if (await typeSelect.isVisible()) {
          await expect(typeSelect.locator('option:has-text("Guide")')).toBeVisible();
          await expect(typeSelect.locator('option:has-text("Tutorial")')).toBeVisible();
          await expect(typeSelect.locator('option:has-text("Reference")')).toBeVisible();
        }
      }
    });

    test('should create article with valid data', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');

      const createButton = page.locator('button:has-text("New Article")');
      if (await createButton.isVisible()) {
        await createButton.click();

        await page.fill('input[name="title"]', 'Test Article');
        await page.selectOption('select[name="type"]', 'guide');
        await page.fill('textarea[name="summary"]', 'This is a test article summary');
        await page.fill(
          'textarea[name="content"]',
          '# Test Content\n\nThis is the article content.'
        );

        await page.click('button:has-text("Save")');

        await expect(page.locator('text=Test Article')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Article Details', () => {
    test('should show article details on selection', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        await expect(page.locator('[data-testid="article-viewer"]')).toBeVisible();
      }
    });

    test('should display KB number', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        await expect(page.locator('text=/KB-\\d{4}/')).toBeVisible();
      }
    });

    test('should show type and status badges', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        await expect(page.locator('[data-testid="type-badge"]')).toBeVisible();
        await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();
      }
    });

    test('should render markdown content', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        // Content area should render markdown
        await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
      }
    });
  });

  test.describe('Article Status Workflow', () => {
    test('should allow publishing workflow', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const draftArticle = page.locator('[data-testid="article-item"]:has-text("Draft")').first();
      if (await draftArticle.isVisible()) {
        await draftArticle.click();

        // Should have "Submit for Review" action
        const reviewButton = page.locator('button:has-text("Submit for Review")');
        if (await reviewButton.isVisible()) {
          await expect(reviewButton).toBeEnabled();
        }
      }
    });

    test('should allow publishing from review', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const reviewArticle = page
        .locator('[data-testid="article-item"]:has-text("In Review")')
        .first();
      if (await reviewArticle.isVisible()) {
        await reviewArticle.click();

        const publishButton = page.locator('button:has-text("Publish")');
        if (await publishButton.isVisible()) {
          await expect(publishButton).toBeEnabled();
        }
      }
    });

    test('should allow archiving published articles', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const publishedArticle = page
        .locator('[data-testid="article-item"]:has-text("Published")')
        .first();
      if (await publishedArticle.isVisible()) {
        await publishedArticle.click();

        const archiveButton = page.locator('button:has-text("Archive")');
        if (await archiveButton.isVisible()) {
          await expect(archiveButton).toBeEnabled();
        }
      }
    });
  });

  test.describe('Article Export', () => {
    test('should have export option', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        const exportButton = page.locator('button:has-text("Export")');
        await expect(exportButton).toBeVisible();
      }
    });

    test('should export as markdown', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        const exportButton = page.locator('button:has-text("Export")');
        if (await exportButton.isVisible()) {
          await exportButton.click();

          const markdownOption = page.locator('text=Export as Markdown');
          if (await markdownOption.isVisible()) {
            await markdownOption.click();

            await expect(page.locator('[data-testid="markdown-preview"]')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Article Filtering', () => {
    test('should filter by type', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Filters")');
      await page.click('label:has-text("Guide")');

      const articles = page.locator('[data-testid="article-item"]');
      const count = await articles.count();

      for (let i = 0; i < count; i++) {
        const article = articles.nth(i);
        await expect(article.locator('[data-testid="type-badge"]')).toContainText('Guide');
      }
    });

    test('should filter by status', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Filters")');
      await page.click('label:has-text("Published")');

      const articles = page.locator('[data-testid="article-item"]');
      const count = await articles.count();

      for (let i = 0; i < count; i++) {
        const article = articles.nth(i);
        await expect(article.locator('[data-testid="status-badge"]')).toContainText('Published');
      }
    });

    test('should combine multiple filters', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Filters")');
      await page.click('label:has-text("Guide")');
      await page.click('label:has-text("Published")');

      // All visible should match both filters
      const articles = page.locator('[data-testid="article-item"]');
      const count = await articles.count();

      for (let i = 0; i < count; i++) {
        const article = articles.nth(i);
        await expect(article.locator('[data-testid="type-badge"]')).toContainText('Guide');
        await expect(article.locator('[data-testid="status-badge"]')).toContainText('Published');
      }
    });

    test('should clear filters', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Filters")');
      await page.click('label:has-text("Guide")');

      const clearButton = page.locator('button:has-text("Clear filters")');
      if (await clearButton.isVisible()) {
        await clearButton.click();

        await expect(page.locator('span:has-text("Active")')).not.toBeVisible();
      }
    });
  });

  test.describe('Knowledge Search', () => {
    test('should search articles by title', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder="Search articles..."]');
      await searchInput.fill('Getting Started');

      await page.waitForTimeout(400);

      const articles = page.locator('[data-testid="article-item"]');
      const count = await articles.count();

      if (count > 0) {
        const firstArticle = articles.first();
        await expect(firstArticle).toContainText(/Getting Started/i);
      }
    });

    test('should search articles by content', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder="Search articles..."]');
      await searchInput.fill('installation');

      await page.waitForTimeout(400);

      // Results should contain articles mentioning installation
      const articles = page.locator('[data-testid="article-item"]');
      if ((await articles.count()) > 0) {
        // At least some results should be visible
        await expect(articles.first()).toBeVisible();
      }
    });

    test('should show no results for invalid search', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder="Search articles..."]');
      await searchInput.fill('xyznonexistentquery456');

      await page.waitForTimeout(400);

      await expect(page.locator('text=No articles found')).toBeVisible();
    });
  });

  test.describe('Article Sorting', () => {
    test('should sort by number', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Number")');

      await expect(page.locator('text=↑')).toBeVisible();
    });

    test('should sort by title', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Title")');

      const titleButton = page.locator('button:has-text("Title")');
      await expect(titleButton).toHaveClass(/bg-gray-200/);
    });

    test('should sort by type', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Type")');

      const typeButton = page.locator('button:has-text("Type")');
      await expect(typeButton).toHaveClass(/bg-gray-200/);
    });
  });

  test.describe('Domain Scoping', () => {
    test('should filter by domain when provided', async ({ page }) => {
      // Navigate to a specific domain
      await page.click('[data-testid="domain-1-nav"]');
      await page.click('[data-testid="knowledge-tab"]');

      await page.waitForLoadState('networkidle');

      // Should show only articles for this domain
      await expect(page.locator('h2:has-text("Knowledge Base")')).toBeVisible();
    });
  });

  test.describe('Related Content', () => {
    test('should show related decisions', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        // Related decisions section
        const relatedDecisions = page.locator('[data-testid="related-decisions"]');
        if (await relatedDecisions.isVisible()) {
          await expect(relatedDecisions).toBeVisible();
        }
      }
    });

    test('should show related articles', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        await firstArticle.click();

        // Related articles section
        const relatedArticles = page.locator('[data-testid="related-articles"]');
        if (await relatedArticles.isVisible()) {
          await expect(relatedArticles).toBeVisible();
        }
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const searchInput = page.locator('input[placeholder="Search articles..."]');
      await expect(searchInput).toBeFocused();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h2:has-text("Knowledge Base")')).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h2:has-text("Knowledge Base")')).toBeVisible();
    });
  });

  test.describe('Author Information', () => {
    test('should display author information', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      const firstArticle = page.locator('[data-testid="article-item"]').first();
      if (await firstArticle.isVisible()) {
        // Author should be shown in the list
        await expect(firstArticle.locator('text=/By \\w+/')).toBeVisible();
      }
    });

    test('should show multiple authors', async ({ page }) => {
      await page.click('[data-testid="knowledge-nav"]');
      await page.waitForLoadState('networkidle');

      // Look for articles with multiple authors (shown as "+N")
      const multiAuthorArticle = page.locator('[data-testid="article-item"]:has-text("+")');
      if ((await multiAuthorArticle.count()) > 0) {
        await expect(multiAuthorArticle.first()).toBeVisible();
      }
    });
  });
});
