import { notificationHandler } from '../_shared/apple-deletion.ts';
import { runtime } from '../_shared/apple-runtime.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
Deno.serve(notificationHandler(runtime(name => Deno.env.get(name))));
