import { indexLesson } from '../modules/ai/retrieval/indexer';

// Runs after a lesson is saved, without making the instructor wait.
// For heavier loads, replace with a BullMQ queue (the call site stays the same).
export function queueIndex(lessonId: string) {
  setImmediate(() => {
    indexLesson(lessonId).catch((err) => console.error('Indexing failed for lesson', lessonId, err));
  });
}
