import path from 'path';
import dotenv from 'dotenv';

// Strictly load .env.test for test suite execution to prevent demo database pollution
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { assertTestDatabase } from '../lib/db/db-guard';

// Enforce test database check before running any integration tests
assertTestDatabase('Automated Test Suite');

