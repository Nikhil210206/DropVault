/** Realtime event names + payloads shared by the Socket.IO server and the worker emitter. */
export const FILE_UPDATED = 'file:updated';

export interface FileUpdatedPayload {
  fileId: string;
  status: string;
  thumbnailKey?: string | null;
  signature?: string;
}

export const userRoom = (userId: string): string => `user:${userId}`;
