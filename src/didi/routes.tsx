import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, Routes, type Location } from 'react-router-dom';
import { useDidi } from './store';
import Home from './screens/home/Home';
import { to } from './paths';

type Loader = () => Promise<{ default: ComponentType }>;
const loaders: Loader[] = [];
function page(l: Loader): LazyExoticComponent<ComponentType> {
  loaders.push(l);
  return lazy(l);
}
export function prefetchDidi() {
  loaders.forEach((l) => l().catch(() => undefined));
}

const Welcome = page(() => import('./screens/onboarding/Welcome'));
const ChooseLanguage = page(() => import('./screens/onboarding/ChooseLanguage'));
const Login = page(() => import('./screens/onboarding/Login'));
const LoginOtp = page(() => import('./screens/onboarding/LoginOtp'));
const Forgot = page(() => import('./screens/onboarding/Forgot'));
const Notifications = page(() => import('./screens/notifications/Notifications'));
const Tasks = page(() => import('./screens/tasks/Tasks'));
const TaskDetail = page(() => import('./screens/tasks/TaskDetail'));
const TaskHistory = page(() => import('./screens/tasks/TaskHistory'));
const AddProgress = page(() => import('./screens/tasks/AddProgress'));
const FarmerVerify = page(() => import('./screens/farmers/FarmerVerify'));
const Bookings = page(() => import('./screens/bookings/Bookings'));
const BookingDetail = page(() => import('./screens/bookings/BookingDetail'));
const Farmers = page(() => import('./screens/farmers/Farmers'));
const FarmerDetail = page(() => import('./screens/farmers/FarmerDetail'));
const Attendance = page(() => import('./screens/attendance/Attendance'));
const MyQr = page(() => import('./screens/myqr/MyQr'));
const Transactions = page(() => import('./screens/transactions/Transactions'));
const TransactionDetail = page(() => import('./screens/transactions/TransactionDetail'));
const Leaderboard = page(() => import('./screens/leaderboard/Leaderboard'));
const Profile = page(() => import('./screens/profile/Profile'));
const MyProfile = page(() => import('./screens/profile/MyProfile'));
const Verify = page(() => import('./screens/profile/Verify'));
const Language = page(() => import('./screens/profile/Language'));
const Password = page(() => import('./screens/profile/Password'));
const Info = page(() => import('./screens/profile/Info'));
const Faqs = page(() => import('./screens/profile/Faqs'));
const Contact = page(() => import('./screens/profile/Contact'));
const Prototype = page(() => import('./screens/profile/Prototype'));

function RootRedirect() {
  const session = useDidi((s) => s.session);
  if (!session.onboarded) return <Navigate to={to('/welcome')} replace />;
  if (!session.signedIn) return <Navigate to={to('/login')} replace />;
  return <Navigate to={to('/home')} replace />;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const signedIn = useDidi((s) => s.session.signedIn);
  return signedIn ? children : <Navigate to={to('/')} replace />;
}
const authed = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>;

export function DidiRoutes({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/didi">
        <Route index element={<RootRedirect />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="welcome/language" element={<ChooseLanguage />} />
        <Route path="login" element={<Login />} />
        <Route path="login/otp" element={<LoginOtp />} />
        <Route path="login/forgot" element={<Forgot />} />

        <Route path="home" element={authed(<Home />)} />
        <Route path="notifications" element={authed(<Notifications />)} />
        <Route path="tasks" element={authed(<Tasks />)} />
        <Route path="tasks/:id" element={authed(<TaskDetail />)} />
        <Route path="tasks/:id/history" element={authed(<TaskHistory />)} />
        <Route path="tasks/:id/progress" element={authed(<AddProgress />)} />
        <Route path="farmers" element={authed(<Farmers />)} />
        <Route path="farmers/:id" element={authed(<FarmerDetail />)} />
        <Route path="farmers/:id/verify" element={authed(<FarmerVerify />)} />
        <Route path="bookings" element={authed(<Bookings />)} />
        <Route path="bookings/:id" element={authed(<BookingDetail />)} />
        <Route path="attendance" element={authed(<Attendance />)} />
        <Route path="qr" element={authed(<MyQr />)} />
        <Route path="transactions" element={authed(<Transactions />)} />
        <Route path="transactions/:id" element={authed(<TransactionDetail />)} />
        <Route path="leaderboard" element={authed(<Leaderboard />)} />
        <Route path="profile" element={authed(<Profile />)} />
        <Route path="profile/me" element={authed(<MyProfile />)} />
        <Route path="profile/verify" element={authed(<Verify />)} />
        <Route path="profile/language" element={authed(<Language />)} />
        <Route path="profile/password" element={authed(<Password />)} />
        <Route path="profile/info/:doc" element={authed(<Info />)} />
        <Route path="profile/faqs" element={authed(<Faqs />)} />
        <Route path="profile/contact" element={authed(<Contact />)} />
        <Route path="profile/prototype" element={authed(<Prototype />)} />
        <Route path="*" element={<Navigate to={to('/')} replace />} />
      </Route>
    </Routes>
  );
}
