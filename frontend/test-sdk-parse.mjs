// Test SDK ODCS parsing
import { readFileSync } from 'fs';

// Load the fixture
const yamlContent = readFileSync('./tests/e2e/fixtures/full-example.odcs.yaml', 'utf-8');

// Import SDK from node_modules directly
const sdk = await import('./node_modules/@offenedatenmodellierung/data-modelling-sdk/data_modelling_wasm.js');

// Initialize WASM
await sdk.default();

// Parse YAML
const resultJson = sdk.parse_odcs_yaml(yamlContent);
const result = JSON.parse(resultJson);

console.log('=== SDK Parse Result ===');
console.log('Number of tables:', result.tables?.length);
console.log('Table names:', result.tables?.map(t => t.name));
console.log('');
console.log('Full result keys:', Object.keys(result));

// Show all table details
result.tables?.forEach((t, i) => {
  console.log(`\nTable ${i}: ${t.name}, columns: ${t.columns?.length}`);
});

// Check if there are errors
if (result.errors?.length > 0) {
  console.log('\nErrors:', result.errors);
}
