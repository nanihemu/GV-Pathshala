import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Role } from '../lib/types';
import Layout from '../components/Layout';
import { Loading } from '../components/ui';
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from '../features/auth/AuthPages';
import DashboardPage from '../features/dashboard/DashboardPage';
import CatalogPage from '../features/catalog/CatalogPage';
import CoursePage from '../features/courses/CoursePage';
import MyCoursesPage from '../features/courses/MyCoursesPage';
import CourseBuilderPage from '../features/courses/CourseBuilderPage';
import AnalyticsPage from '../features/ai/AnalyticsPage';
import LessonPage from '../features/lessons/LessonPage';
import QuizBuilderPage from '../features/quizzes/QuizBuilderPage';
import SubmissionsPage from '../features/assignments/SubmissionsPage';
import GradesPage from '../features/grades/GradesPage';
import AdminPage from '../features/admin/AdminPage';

function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPage />} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="courses/:id" element={<CoursePage />} />
        <Route path="lessons/:id" element={<LessonPage />} />
        <Route path="grades" element={<Protected roles={['STUDENT']}><GradesPage /></Protected>} />
        <Route path="instructor/courses" element={<Protected roles={['INSTRUCTOR', 'ADMIN']}><MyCoursesPage /></Protected>} />
        <Route path="instructor/courses/:id" element={<Protected roles={['INSTRUCTOR', 'ADMIN']}><CourseBuilderPage /></Protected>} />
        <Route path="instructor/courses/:id/analytics" element={<Protected roles={['INSTRUCTOR', 'ADMIN']}><AnalyticsPage /></Protected>} />
        <Route path="instructor/lessons/:id/quiz" element={<Protected roles={['INSTRUCTOR', 'ADMIN']}><QuizBuilderPage /></Protected>} />
        <Route path="instructor/lessons/:id/submissions" element={<Protected roles={['INSTRUCTOR', 'ADMIN']}><SubmissionsPage /></Protected>} />
        <Route path="admin" element={<Protected roles={['ADMIN']}><AdminPage /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
