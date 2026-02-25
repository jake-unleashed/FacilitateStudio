import type { GenerationProvider, SupportedGenerationProvider } from './types.js';
import { createMeshyProvider } from './meshyProvider.js';
import { createTripoProvider } from './tripoProvider.js';

export function createGenerationProvider(input: {
  provider: SupportedGenerationProvider;
  meshyApiKey?: string;
  tripoApiKey?: string;
}): GenerationProvider {
  if (input.provider === 'meshy') {
    if (!input.meshyApiKey) {
      throw new Error('MESHY_API_KEY is required when AI_3D_PROVIDER=meshy');
    }
    return createMeshyProvider(input.meshyApiKey);
  }

  if (!input.tripoApiKey) {
    throw new Error('TRIPO_API_KEY is required when AI_3D_PROVIDER=tripo');
  }
  return createTripoProvider(input.tripoApiKey);
}
