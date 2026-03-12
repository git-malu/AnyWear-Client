import { defineConfig } from 'orval';

export default defineConfig({
  anywear: {
    input: './AnyWear-Meta/api/anywear_openapi.yaml',
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: false,
      override: {
        mutator: {
          path: './src/api/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
