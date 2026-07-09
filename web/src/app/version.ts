// Version information for Portfolium Web
// This file can be updated automatically by CI/CD

export const VERSION = '0.3.2';
const BUILD_DATE = '2026-07-09';
const GIT_COMMIT = 'local';

export interface VersionInfo {
  version: string;
  buildDate: string;
  gitCommit: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    version: VERSION,
    buildDate: BUILD_DATE,
    gitCommit: GIT_COMMIT,
  };
}
