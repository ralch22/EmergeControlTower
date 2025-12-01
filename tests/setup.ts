import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => {
  console.log('Starting test suite...');
});

afterEach(() => {
  // Clean up after each test
});

afterAll(() => {
  console.log('Test suite completed.');
});
