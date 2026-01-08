# Knowledge Base User Guide

This guide explains how to use the Knowledge Base feature to manage documentation and knowledge articles in your data modelling workspace.

## Overview

The Knowledge Base allows you to create, organize, and search documentation articles. Articles can be:

- Guides and tutorials for your data models
- Reference documentation for schemas and APIs
- Troubleshooting guides and runbooks
- Conceptual explanations of your architecture

## Requirements

Knowledge Base requires **SDK 1.13.1** or later. Check your SDK version in Settings > About.

## Creating an Article

### From the Knowledge Panel

1. Navigate to a domain or workspace
2. Open the **Knowledge** tab
3. Click **New Article**
4. Fill in the required fields:
   - **Title**: A descriptive title for the article
   - **Type**: The type of article
   - **Summary**: A brief description (shown in list view)
   - **Content**: The full article content (Markdown supported)

### Article Types

| Type                | Use For                                      |
| ------------------- | -------------------------------------------- |
| **Guide**           | Step-by-step instructions, how-to articles   |
| **Tutorial**        | Learning-focused content with examples       |
| **Reference**       | API docs, schema definitions, specifications |
| **Concept**         | Explanations of ideas and architecture       |
| **Troubleshooting** | Problem-solving guides, FAQs                 |
| **Runbook**         | Operational procedures, incident response    |

## Article Status Workflow

Articles follow a publishing lifecycle:

```
Draft → Review → Published
                    ↓
                Archived
                    ↓
               Deprecated
```

### Status Descriptions

| Status         | Description                              |
| -------------- | ---------------------------------------- |
| **Draft**      | Work in progress, not visible to readers |
| **Review**     | Ready for review before publishing       |
| **Published**  | Live and visible to all users            |
| **Archived**   | No longer current but preserved          |
| **Deprecated** | Outdated, may be removed                 |

### Changing Status

1. Open an article
2. Click the status dropdown in the workflow section
3. Select the new status
4. Confirm the change

**Valid Transitions:**

- Draft → Review
- Review → Published, Draft
- Published → Archived, Deprecated, Review
- Archived → Published

## Writing Content

### Markdown Support

Articles support full Markdown syntax:

````markdown
# Heading 1

## Heading 2

**Bold** and _italic_ text

- Bullet lists
- With multiple items

1. Numbered lists
2. Are also supported

`inline code` and code blocks:

```python
def example():
    return "Hello, World!"
```
````

> Blockquotes for important notes

[Links](https://example.com) and images:
![Alt text](image.png)

| Tables | Work |
| ------ | ---- |
| Too    | Yes  |

````

### Best Practices for Content

1. **Start with a summary**: First paragraph should explain what the article covers
2. **Use headings**: Break content into logical sections
3. **Include examples**: Code snippets and real-world examples help understanding
4. **Add cross-references**: Link to related articles and decisions
5. **Keep updated**: Review and update articles regularly

## Article Numbering

Articles are automatically numbered in sequence:
- KB-0001
- KB-0002
- etc.

The number is assigned when the article is created and never changes.

## Linking Articles

### Related Articles

Link to other Knowledge Base articles:

1. Open an article
2. In the **Related Articles** section, click **Add**
3. Search for and select related articles

### Related Decisions

Link to Architecture Decisions:

1. Open an article
2. In the **Related Decisions** section, click **Add**
3. Search for and select related decisions

### Prerequisites

Define articles that should be read first:

1. Open an article
2. In the **Prerequisites** section, click **Add**
3. Select articles readers should review first

### See Also

Add suggestions for further reading:

1. Open an article
2. In the **See Also** section, click **Add**
3. Select recommended follow-up articles

## Domain Association

Articles can be scoped to specific domains:

1. When creating an article, select a **Domain**
2. The article will appear in that domain's Knowledge tab
3. Articles can also be created from within a domain
4. Domain-scoped articles are filtered when viewing domain knowledge

## Authors and Reviewers

### Authors

People who wrote or contributed to the article:

1. In the article editor, find the **Authors** field
2. Add author names or email addresses
3. Multiple authors can be listed

### Reviewers

People who reviewed the article before publishing:

1. In the article editor, find the **Reviewers** field
2. Add reviewer names or email addresses
3. Reviewers are tracked when article moves to Review status

## Search and Filter

### Search

Use the search box to find articles by:
- Title
- Summary
- Full content

The search uses full-text matching and ranks results by relevance.

### Filters

Filter the article list by:
- **Type**: Show only Guides, Tutorials, etc.
- **Status**: Show only Published, Draft, etc.

Click **Filters** to open the filter panel.

### Sorting

Sort articles by:
- **Number**: KB number (default, newest first)
- **Title**: Alphabetical
- **Type**: By article type
- **Updated**: By last update date

## Exporting Articles

### Export to Markdown

Export articles as Markdown files:

1. Open an article
2. Click **Export** → **Export as Markdown**
3. The markdown file will download

### Export Format

The exported markdown includes metadata:

```markdown
# KB-0001. Getting Started Guide

**Type:** Guide
**Status:** Published
**Authors:** Jane Doe, John Smith
**Published:** 2024-01-15

## Summary

A comprehensive guide to getting started with...

---

# Getting Started

Welcome to the data modelling application...

## Prerequisites

Before you begin, ensure you have...

## Step 1: Create a Workspace

First, create a new workspace...

---

**Tags:** getting-started, tutorial, beginner
````

## Tags and Metadata

### Adding Tags

Organize articles with tags:

1. In the article editor, find the **Tags** field
2. Add relevant tags
3. Tags help with filtering and discovery

### Custom Properties

Add custom metadata:

1. In the article editor, expand **Advanced**
2. Add key-value pairs for custom properties
3. Custom properties are preserved in exports

## Best Practices

### Writing Effective Articles

1. **Clear Titles**: Use descriptive, searchable titles
2. **Concise Summaries**: First 2-3 sentences should explain the article
3. **Structured Content**: Use headings to organize information
4. **Examples**: Include practical examples and code samples
5. **Links**: Reference related articles and decisions

### Article Types Selection

| If you're writing...   | Use this type   |
| ---------------------- | --------------- |
| How to do something    | Guide           |
| Learning material      | Tutorial        |
| API or schema docs     | Reference       |
| Explaining an idea     | Concept         |
| Problem solutions      | Troubleshooting |
| Operational procedures | Runbook         |

### Review Process

1. Author creates article as **Draft**
2. Author completes content and moves to **Review**
3. Reviewers check accuracy and clarity
4. Approved articles move to **Published**
5. Regular reviews keep content current

## Keyboard Shortcuts

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `/`      | Focus search                    |
| `n`      | New article (when list focused) |
| `↑/↓`    | Navigate article list           |
| `Enter`  | Open selected article           |
| `Esc`    | Close article viewer            |

## Troubleshooting

### Articles Not Loading

1. Check that SDK 1.13.1+ is installed
2. Verify workspace path is correct
3. Check browser console for errors

### Cannot Change Status

1. Verify the transition is valid
2. Check you have edit permissions
3. Deprecated articles cannot change status

### Search Not Finding Results

1. Wait for debounce (300ms delay)
2. Check for typos in search term
3. Clear filters that might be hiding results
4. Search includes title, summary, and content

### Markdown Not Rendering

1. Check for syntax errors in markdown
2. Ensure code blocks have closing backticks
3. Tables require header separator row

## Integration with Decisions

Knowledge Base articles and Decisions work together:

1. **Document Decisions**: Create articles explaining decision rationale
2. **Link Related Content**: Connect decisions to relevant documentation
3. **Cross-Reference**: Use "Related Decisions" in articles
4. **Search Together**: Both appear in unified search

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Database and sync settings
- [Decision Logs Guide](DECISION_LOGS.md) - Architecture decision records
