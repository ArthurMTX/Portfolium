// Version information for Portfolium Web
// This file can be updated automatically by CI/CD

export const VERSION = '0.2.1';
export const BUILD_DATE = '2025-11-06';
export const GIT_COMMIT = 'local';

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
