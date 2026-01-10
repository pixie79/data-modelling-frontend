# Feature Request: PDF and Branded Markdown Export for ODCS, ODPS, KB, and ADR

## Summary

Add PDF and enhanced Markdown export functionality for Open Data Contract Standard (ODCS), Open Data Product Standard (ODPS), Knowledge Base articles, and Architecture Decision Records (ADR) with OpenDataModelling branding support.

## Motivation

Users need to share data contracts, product specifications, knowledge articles, and architectural decisions with stakeholders who may not have access to the data modelling application. Professional, branded PDF and Markdown exports would enable:

- Sharing documentation with external partners and stakeholders
- Inclusion in formal documentation packages
- Printing for meetings and reviews
- Archival purposes with consistent branding

## Proposed Solution

### 1. Branded Export Configuration

Add support for export configuration that includes branding elements:

```rust
pub struct ExportBranding {
    /// Logo image (base64 encoded or URL)
    pub logo: Option<String>,
    /// Header text (e.g., company name)
    pub header_text: Option<String>,
    /// Footer text (e.g., copyright notice)
    pub footer_text: Option<String>,
    /// Primary brand color (hex)
    pub primary_color: Option<String>,
}

pub struct ExportOptions {
    /// Output format: "pdf" or "markdown"
    pub format: String,
    /// Branding configuration
    pub branding: Option<ExportBranding>,
    /// Include table of contents
    pub include_toc: bool,
    /// Include metadata section
    pub include_metadata: bool,
}
```

### 2. Export Functions

Add the following export functions to the SDK:

```rust
// ODCS Export
pub fn export_odcs_to_pdf(workspace: &ODCSWorkspace, options: &ExportOptions) -> Result<Vec<u8>, Error>;
pub fn export_odcs_to_markdown(workspace: &ODCSWorkspace, options: &ExportOptions) -> Result<String, Error>;

// ODPS Export  
pub fn export_odps_to_pdf(product: &DataProduct, options: &ExportOptions) -> Result<Vec<u8>, Error>;
pub fn export_odps_to_markdown(product: &DataProduct, options: &ExportOptions) -> Result<String, Error>;

// Knowledge Base Export
pub fn export_knowledge_to_pdf(article: &KnowledgeArticle, options: &ExportOptions) -> Result<Vec<u8>, Error>;
// Note: export_knowledge_to_markdown already exists

// ADR Export
pub fn export_decision_to_pdf(decision: &Decision, options: &ExportOptions) -> Result<Vec<u8>, Error>;
// Note: export_decision_to_markdown already exists
```

### 3. CLI Commands

Extend CLI with branding options:

```bash
# ODCS export
dm odcs export --format pdf --logo /path/to/logo.png --footer "(c) opendatamodelling.com" output.pdf
dm odcs export --format markdown --branding opendatamodelling output.md

# ODPS export
dm odps export --format pdf --logo /path/to/logo.png --footer "(c) opendatamodelling.com" output.pdf

# Knowledge export (extend existing)
dm knowledge export --format pdf --branding opendatamodelling article.yaml output.pdf

# Decision export (extend existing)
dm decision export --format pdf --branding opendatamodelling decision.yaml output.pdf
```

### 4. WASM Support

Expose these functions via WASM for browser-based export:

```typescript
interface ExportBranding {
  logo?: string;        // Base64 encoded image
  headerText?: string;
  footerText?: string;
  primaryColor?: string;
}

interface ExportOptions {
  format: 'pdf' | 'markdown';
  branding?: ExportBranding;
  includeToc?: boolean;
  includeMetadata?: boolean;
}

// WASM exports
export function export_odcs_to_pdf(workspace_json: string, options_json: string): Uint8Array;
export function export_odcs_to_markdown(workspace_json: string, options_json: string): string;
export function export_odps_to_pdf(product_json: string, options_json: string): Uint8Array;
export function export_odps_to_markdown(product_json: string, options_json: string): string;
export function export_knowledge_to_pdf(article_json: string, options_json: string): Uint8Array;
export function export_decision_to_pdf(decision_json: string, options_json: string): Uint8Array;
```

## PDF Layout Specification

### Header
- Logo positioned top-left (max height: 40px)
- Document title centered
- Generation date top-right

### Body Content

**For ODCS (Data Contract):**
- Contract metadata (version, status, owner)
- Schema definitions with data types
- Quality rules and constraints
- SLA definitions
- Terms and conditions

**For ODPS (Data Product):**
- Product metadata (name, version, owner)
- Input/output ports
- Data quality metrics
- Lineage information
- Access policies

**For Knowledge Base:**
- Article title and metadata
- Full content with markdown rendering
- Tags and categories
- Related articles

**For ADR:**
- Decision title and status
- Context section
- Decision statement
- Consequences (positive/negative/neutral)
- Related decisions

### Footer
- Copyright text centered (e.g., "(c) opendatamodelling.com")
- Page number right-aligned
- Document version/hash left-aligned

## Implementation Considerations

### PDF Generation
Consider using one of:
- `printpdf` crate for native Rust PDF generation
- `wkhtmltopdf` wrapper for HTML-to-PDF conversion
- `headless_chrome` for browser-based rendering

For WASM compatibility, generating styled HTML that can be converted to PDF client-side may be the most practical approach.

### Markdown Enhancement
The existing markdown export should be extended to include:
- YAML frontmatter with metadata
- Branding placeholders that frontends can process
- Consistent heading structure for TOC generation

## Acceptance Criteria

- [ ] ODCS can be exported to PDF with branding
- [ ] ODCS can be exported to branded Markdown
- [ ] ODPS can be exported to PDF with branding
- [ ] ODPS can be exported to branded Markdown
- [ ] Knowledge articles can be exported to PDF with branding
- [ ] ADRs can be exported to PDF with branding
- [ ] CLI commands support branding options
- [ ] WASM bindings available for browser use
- [ ] Default OpenDataModelling branding preset available
- [ ] Unit tests for all export functions
- [ ] Documentation updated

## Related

- Existing `decision export` CLI command
- Existing `knowledge export` CLI command
- Frontend viewer components that will consume these exports
