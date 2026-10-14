export type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
export type LessonType = 'VIDEO' | 'READING' | 'QUIZ' | 'ASSIGNMENT';

export interface User { id: string; name: string; email: string; role: Role; interests?: string[]; insightsOptOut?: boolean }
export interface LessonStub { id: string; title: string; type: LessonType; durationMin: number; position: number; dueDate?: string | null }
export interface CourseDetail {
  id: string; title: string; description: string; level: string; status: string; aiTutorEnabled: boolean; integrityMode: boolean; inviteOnly: boolean;
  category: { id: string; name: string }; instructor: { id: string; name: string };
  modules: { id: string; title: string; position: number; lessons: LessonStub[] }[];
  enrolled: boolean; canEdit: boolean; completedLessonIds: string[]; rating: number | null; reviews: number;
}
export interface Source { lessonId: string; lessonTitle: string }
export interface ChatItem { id?: string; role: 'user' | 'assistant'; text: string; sources?: Source[] | null; refused?: boolean; rating?: number | null }

export const TYPE_LABEL: Record<LessonType, string> = { VIDEO: 'Video', READING: 'Reading', QUIZ: 'Quiz', ASSIGNMENT: 'Assignment' };
export const COURSE_COLORS = ['#0B6E75', '#7A4EAB', '#C25A1E', '#2A6FB0', '#B03A64'];
export const colorFor = (s: string) => COURSE_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COURSE_COLORS.length];
export const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
