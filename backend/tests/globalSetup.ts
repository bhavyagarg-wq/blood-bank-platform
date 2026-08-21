import { execSync } from 'child_process';

/** Applies migrations to the throwaway test database before the suite runs. */
export default function globalSetup(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/bloodbank_test?schema=public';

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
