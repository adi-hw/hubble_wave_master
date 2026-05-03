const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

// Optional sub-packages that this CLI never instantiates at runtime.
// They are referenced via `loadPackage` / dynamic require inside NestJS
// core and TypeORM. Marking them as externals tells webpack to leave them
// as commonjs requires; if they are not installed at runtime the host
// libraries fall back gracefully.
const optionalExternals = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  '@nestjs/mapped-types',
  'pg-native',
  'pg-query-stream',
  'mongodb',
  'mysql',
  'mysql2',
  'oracledb',
  'better-sqlite3',
  'sqlite3',
  'sql.js',
  'mssql',
  'redis',
  'react-native-sqlite-storage',
  '@google-cloud/spanner',
  '@sap/hana-client',
  '@sap/hana-client/extension/Stream',
  'typeorm-aurora-data-api-driver',
];

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/svc-migrations'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
      externalDependencies: optionalExternals,
    }),
  ],
};
