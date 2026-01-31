/**
 * Integration test setup
 * 
 * Runs before all integration tests to verify Zoekt is available.
 */

import { beforeAll, afterAll } from 'vitest';
import { waitForZoekt, getZoektUrl, isZoektAvailable } from '../helpers/zoekt-health.js';

const zoektUrl = getZoektUrl();

beforeAll(async () => {
  console.log(`\n🔍 Checking Zoekt availability at ${zoektUrl}...`);
  
  const available = await isZoektAvailable(zoektUrl);
  
  if (!available) {
    console.log('⏳ Zoekt not immediately available, waiting up to 60 seconds...');
    try {
      await waitForZoekt(zoektUrl, 60000);
    } catch (error) {
      console.error('\n❌ Zoekt infrastructure is not running!');
      console.error('   Start it with: docker compose -f docker/docker-compose.test.yml up -d');
      console.error('   Or: docker compose -f docker/docker-compose.yml up -d');
      throw error;
    }
  }
  
  console.log('✅ Zoekt is available\n');
});

afterAll(async () => {
  // Cleanup any test resources if needed
  console.log('\n🧹 Integration tests complete\n');
});

/**
 * Export the Zoekt URL for use in tests
 */
export { zoektUrl };
