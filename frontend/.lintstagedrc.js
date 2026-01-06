/**
 * lint-staged configuration
 * Runs checks on staged files before commit
 */
export default {
  // TypeScript and JavaScript files - lint and format
  '**/*.{ts,tsx,js,jsx}': [
    'ESLINT_USE_FLAT_CONFIG=false eslint --fix', // Auto-fix linting issues (use legacy config)
    'prettier --write', // Format code
  ],

  // JSON, CSS, Markdown, YAML files - format only
  '**/*.{json,css,md,yml,yaml}': [
    'prettier --write', // Format code
  ],
};
