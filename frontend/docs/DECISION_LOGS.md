# Decision Logs User Guide

This guide explains how to use the Decision Logs feature to manage Architecture Decision Records (ADRs) in your data modelling workspace.

## Overview

Decision Logs allow you to document and track architectural decisions using the MADR (Markdown Architectural Decision Records) format. Each decision captures:

- The context and problem being addressed
- The decision made
- Considered alternatives
- Consequences of the decision
- Status and lifecycle

## Requirements

Decision Logs require **SDK 1.13.1** or later. Check your SDK version in Settings > About.

## Creating a Decision

### From the Decision Panel

1. Navigate to a domain or workspace
2. Open the **Decisions** tab
3. Click **New Decision**
4. Fill in the required fields:
   - **Title**: A concise description of the decision
   - **Category**: The type of decision
   - **Context**: Background information and the problem being solved
   - **Decision**: The actual decision made

### Decision Categories

| Category     | Use For                                        |
| ------------ | ---------------------------------------------- |
| Architecture | System structure, patterns, components         |
| Technology   | Tools, frameworks, languages, platforms        |
| Process      | Development workflows, team practices          |
| Security     | Authentication, authorization, data protection |
| Data         | Storage, schemas, data flows                   |
| Integration  | APIs, external systems, protocols              |

## Decision Status Workflow

Decisions follow a defined lifecycle:

```
Draft → Proposed → Accepted/Rejected
                        ↓
              Deprecated/Superseded
```

### Status Descriptions

| Status         | Description                                |
| -------------- | ------------------------------------------ |
| **Draft**      | Work in progress, not yet ready for review |
| **Proposed**   | Ready for team review and discussion       |
| **Accepted**   | Approved and should be followed            |
| **Rejected**   | Reviewed but not approved                  |
| **Deprecated** | No longer recommended but still valid      |
| **Superseded** | Replaced by a newer decision               |

### Changing Status

1. Open a decision
2. Click the status dropdown in the workflow section
3. Select the new status
4. Confirm the change

**Note**: Only valid transitions are allowed:

- Draft → Proposed, Rejected
- Proposed → Accepted, Rejected, Draft
- Accepted → Deprecated, Superseded
- Rejected → Draft

## Decision Options

Document the alternatives you considered:

1. In the decision editor, scroll to **Considered Options**
2. Click **Add Option**
3. For each option, provide:
   - **Title**: Option name
   - **Description**: What this option entails
   - **Pros**: Advantages of this option
   - **Cons**: Disadvantages of this option

## Decision Numbering

Decisions are automatically numbered in sequence:

- ADR-0001
- ADR-0002
- etc.

The number is assigned when the decision is created and never changes.

## Linking Decisions

### Related Decisions

Link decisions that are related:

1. Open a decision
2. In the **Related Decisions** section, click **Add**
3. Search for and select related decisions

### Superseding Decisions

When a decision replaces another:

1. Open the new decision
2. Change status to **Accepted**
3. Open the old decision
4. Change status to **Superseded**
5. Select the new decision as the superseding decision

### Related Knowledge

Link to Knowledge Base articles:

1. Open a decision
2. In the **Related Knowledge** section, click **Add**
3. Search for and select related articles

## Domain Association

Decisions can be associated with specific domains:

1. When creating a decision, select a **Domain**
2. The decision will appear in that domain's Decisions tab
3. Decisions can also be created from within a domain

## RACI Matrix

Document stakeholders using the RACI model:

| Field         | Description                      |
| ------------- | -------------------------------- |
| **Authors**   | People who wrote the decision    |
| **Deciders**  | People with authority to approve |
| **Consulted** | Subject matter experts consulted |
| **Informed**  | People notified of the decision  |

## Search and Filter

### Search

Use the search box to find decisions by:

- Title
- Context
- Decision content

### Filters

Filter the decision list by:

- **Status**: Show only Draft, Proposed, etc.
- **Category**: Show only Architecture, Security, etc.

Click **Filters** to open the filter panel, then select your criteria.

### Sorting

Sort decisions by:

- **Number**: ADR number (default, newest first)
- **Title**: Alphabetical
- **Status**: By status value
- **Updated**: By last update date

## Exporting Decisions

### Export to Markdown

Export decisions in MADR format:

1. Open a decision
2. Click **Export** → **Export as Markdown**
3. The markdown file will download

### Export Format

The exported markdown follows the MADR template:

```markdown
# ADR-0001. Use React for Frontend

**Status:** Accepted  
**Category:** Technology  
**Date:** 2024-01-15

**Deciders:** John Doe, Jane Smith

## Context

We need to choose a frontend framework...

## Decision

We will use React for our frontend...

## Considered Options

### Option 1: React

Popular component library...

**Pros:**

- Large ecosystem
- Good documentation

**Cons:**

- Learning curve

## Consequences

Team needs React training...
```

## Best Practices

### Writing Good Decisions

1. **Be Specific**: Clearly state what is being decided
2. **Provide Context**: Explain why this decision is needed
3. **Document Alternatives**: Show other options considered
4. **List Consequences**: Both positive and negative outcomes
5. **Keep Updated**: Change status as the decision evolves

### When to Create Decisions

Create a decision when:

- Making significant architectural changes
- Choosing between technologies or approaches
- Establishing patterns or conventions
- Changing existing architectural decisions

### Review Process

1. Author creates decision as **Draft**
2. Author moves to **Proposed** when ready
3. Team reviews and discusses
4. Deciders approve or reject
5. Author updates based on feedback

## Keyboard Shortcuts

| Shortcut | Action                           |
| -------- | -------------------------------- |
| `/`      | Focus search                     |
| `n`      | New decision (when list focused) |
| `↑/↓`    | Navigate decision list           |
| `Enter`  | Open selected decision           |
| `Esc`    | Close decision viewer            |

## Troubleshooting

### Decisions Not Loading

1. Check that SDK 1.13.1+ is installed
2. Verify workspace path is correct
3. Check browser console for errors

### Cannot Change Status

1. Verify the transition is valid
2. Check you have edit permissions
3. For Superseded, ensure superseding decision is selected

### Search Not Working

1. Wait for debounce (300ms delay)
2. Check for typos in search term
3. Clear filters that might be hiding results

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Database and sync settings
- [Knowledge Base Guide](KNOWLEDGE_BASE.md) - Documentation management
