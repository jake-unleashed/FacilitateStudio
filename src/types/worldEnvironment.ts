export type {
  WorldEnvironmentCreateRequestBody,
  WorldEnvironmentCreateResponse,
  WorldEnvironmentResult,
  WorldEnvironmentStatusResponse,
} from '../../shared/api/worldEnvironment/types.js';

export type WorldEnvironmentFlowPhase =
  | 'idle'
  | 'uploading'
  | 'generating'
  | 'loading'
  | 'ready'
  | 'error';
