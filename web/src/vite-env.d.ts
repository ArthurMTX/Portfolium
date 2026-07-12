/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Type declarations for lucide-static
declare module 'lucide-static/tags.json' {
  const tags: Record<string, string[]>
  export default tags
}
