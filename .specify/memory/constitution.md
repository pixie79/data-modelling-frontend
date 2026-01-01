<!--
  Sync Impact Report:
  Version change: 1.0.0 → 1.1.0 (minor - new principle added)
  Modified principles: N/A
  Added sections:
    - Core Principle VI. Complete Implementation & Testing (NON-NEGOTIABLE)
    - Test coverage requirements in Quality Gates
  Removed sections: N/A
  Templates requiring updates:
    ✅ plan-template.md - Constitution Check section will reference new principle
    ✅ tasks-template.md - Will include test coverage requirements
  Follow-up TODOs: None
-->

# dm Constitution

## Core Principles

### I. Code Quality & Compilation (NON-NEGOTIABLE)

All code MUST compile without errors or warnings. Code MUST be formatted
following language-specific best practices and style guides. This includes
proper indentation, naming conventions, code organization, and adherence to
established patterns for the chosen language and framework.

**Rationale**: Compilable, well-formatted code reduces cognitive load, enables
effective code review, prevents runtime errors, and maintains consistency
across the codebase.

### II. Dependency Management

All dependencies MUST use the latest stable versions of components and
libraries for the chosen language and framework. When selecting dependencies,
prefer actively maintained, widely-adopted solutions that align with current
best practices. Regularly update dependencies to receive security patches and
performance improvements.

**Rationale**: Using current dependencies ensures access to latest features,
security fixes, and community support. It reduces technical debt and
maintenance burden over time.

### III. Security-First Design (NON-NEGOTIABLE)

Security considerations MUST be integrated from the initial design phase, not
added as an afterthought. All code MUST follow security best practices
including: input validation, output encoding, secure authentication and
authorization, secure data storage, protection against common vulnerabilities
(OWASP Top 10), and defense-in-depth strategies.

**Rationale**: Security vulnerabilities introduced during design are costly to
fix later. A security-first approach prevents entire classes of vulnerabilities
and protects users and systems from harm.

### IV. Security Auditing

Regular security audits MUST be conducted to identify and remediate
vulnerabilities. This includes: automated dependency scanning, static code
analysis for security issues, manual security reviews for critical components,
and penetration testing for deployed systems. All identified vulnerabilities
MUST be prioritized and addressed according to severity.

**Rationale**: Proactive security auditing identifies vulnerabilities before they
can be exploited. Regular audits ensure ongoing security posture as the codebase
evolves.

### V. Linting Discipline

Code MUST be linted frequently throughout development, not just before commit.
Linting MUST be integrated into the development workflow and automated where
possible. All linting errors MUST be resolved before code is considered
complete. Linting rules MUST be configured to enforce code quality standards
and best practices for the chosen language.

**Rationale**: Frequent linting catches issues early when they are easiest to
fix. It maintains code quality consistency and prevents accumulation of
technical debt.

### VI. Complete Implementation & Testing (NON-NEGOTIABLE)

Partial implementations, TODOs, placeholder code, or similar incomplete code
MUST NOT be committed unless specifically authorized by the end user. AI agents
MUST NEVER authorize partial implementations or TODOs. All code MUST be fully
working implementations with complete functionality. All code MUST achieve a
minimum of 95% test coverage measured by lines, branches, functions, and
statements. Test coverage MUST be verified before code is considered complete
and before merge.

**Rationale**: Partial implementations create technical debt, reduce code
quality, and make maintenance difficult. Complete implementations ensure
reliability and maintainability. High test coverage provides confidence in code
correctness and prevents regressions.

## Development Workflow

### Code Quality Gates

- All code MUST pass compilation checks before being committed
- All code MUST pass formatting checks (automated formatting tools preferred)
- All code MUST pass linting checks with zero errors
- All code MUST pass security scanning before merge
- Dependencies MUST be reviewed for security vulnerabilities before integration

### Linting Requirements

- Linting MUST be run during active development (not deferred to end of task)
- Linting MUST be configured in CI/CD pipelines
- Linting errors MUST block merge requests
- Linting configuration MUST be version-controlled and shared across team

### Security Review Process

- Security considerations MUST be documented in design documents
- Security audits MUST be performed for all new features
- Dependency updates MUST include security vulnerability checks
- Critical security fixes MUST be prioritized and deployed promptly

## Quality Gates

### Pre-Commit Requirements

- Code compiles without errors or warnings
- Code passes all linting checks
- Code follows formatting standards
- Dependencies are up-to-date and secure

### Pre-Merge Requirements

- All pre-commit requirements met
- Security scanning completed and issues resolved
- Code review completed with security focus
- All tests pass with 95% minimum coverage (lines, branches, functions, statements)
- No TODOs, partial implementations, or placeholder code (unless explicitly authorized by end user)
- Code is fully functional and complete

### Pre-Deployment Requirements

- All pre-merge requirements met
- Security audit completed for critical components
- Dependencies verified for known vulnerabilities
- Documentation updated (if applicable)

## Governance

This constitution supersedes all other development practices and guidelines.
All code contributions MUST comply with these principles. Amendments to this
constitution require:

1. Documentation of the proposed change and rationale
2. Review and approval process
3. Update to version number following semantic versioning
4. Propagation of changes to dependent templates and documentation
5. Communication to all team members

All pull requests and code reviews MUST verify compliance with these
principles. Complexity or exceptions MUST be explicitly justified and
documented. Violations of these principles MUST be addressed before code
acceptance.

**Version**: 1.1.0 | **Ratified**: 2025-12-31 | **Last Amended**: 2025-12-31
