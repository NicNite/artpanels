export type GenerateRequest = {
  prompt: string;
  negativePrompt?: string;
  count: number;
  width: number;
  height: number;
  seed?: number;
  params?: Record<string, unknown>;
};

export type GenerateEvent =
  | { type: "progress"; index: number; step: number; totalSteps: number }
  | { type: "image"; index: number; data: Buffer; seed: number }
  | { type: "error"; index: number; message: string }
  | { type: "done" };

export interface ImageProvider {
  id: string;
  name: string;
  healthCheck(): Promise<boolean>;
  generate(request: GenerateRequest): AsyncGenerator<GenerateEvent>;
}
