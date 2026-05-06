import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'today-date',
  brand: {
    displayName: '오늘뭐하지',
    primaryColor: '#3182F6',
    icon: "https://static.toss.im/icons/png/4x/icon-toss-logo.png",
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'npm run dev',
      build: 'npm run build',
    },
  },
  permissions: [],
  outdir: 'out',
});
