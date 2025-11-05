import { useState, useEffect } from 'react';
import { Info, Code, Calendar, GitCommit } from 'lucide-react';
import { getVersionInfo } from '../version';
import api from '../lib/api';
import { useTranslation } from 'react-i18next'

interface ApiVersionInfo {
  version: string;
  build_date: string;
  git_commit: string;
}

export default function VersionInfo() {
  const [apiVersion, setApiVersion] = useState<ApiVersionInfo | null>(null);
  const webVersion = getVersionInfo();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchApiVersion = async () => {
      try {
        const data = await api.getVersion();
        setApiVersion(data);
      } catch (error) {
        console.error('Failed to fetch API version:', error);
      }
    };
    fetchApiVersion();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('versionInfo.versionInformation')}</h3>
      </div>

      <div className="space-y-4">
        {/* Web App Version */}
        <div className="border-l-4 border-blue-500 pl-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('versionInfo.webApplication')}</h4>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              <span className="font-mono">v{webVersion.version}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{webVersion.buildDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4" />
              <span className="font-mono text-xs">{webVersion.gitCommit}</span>
            </div>
          </div>
        </div>

        {/* API Version */}
        <div className="border-l-4 border-green-500 pl-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('versionInfo.apiServer')}</h4>
          {apiVersion ? (
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                <span className="font-mono">v{apiVersion.version}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{apiVersion.build_date}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4" />
                <span className="font-mono text-xs">{apiVersion.git_commit}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('versionInfo.loadingVersionInfo')}</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2025 Portfolium. Licensed under MIT.
        </p>
      </div>
    </div>
  );
}
