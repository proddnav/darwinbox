// In-memory progress store (in production, use Redis or similar)
const progressStore = new Map<string, { progress: number; message: string }>();

export function setProgress(taskId: string, progress: number, message: string) {
  progressStore.set(taskId, { progress, message });
  
  // Clean up old progress entries after 5 minutes
  setTimeout(() => {
    progressStore.delete(taskId);
  }, 5 * 60 * 1000);
}

export function getProgress(taskId: string) {
  return progressStore.get(taskId) || { progress: 0, message: 'Starting...' };
}




