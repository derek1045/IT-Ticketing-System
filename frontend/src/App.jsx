import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import CreateTicket from "./pages/CreateTicket";
import TicketDetail from "./pages/TicketDetail";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import { useUI } from "./context/UIContext";
import { useAuth } from "./context/AuthContext";
import ToastStack from "./components/ToastStack";
import Badge from "./components/Badge";
import SkeletonCard from "./components/SkeletonCard";
import ProfileMenu from "./components/ProfileMenu";
import RecentTickets from "./components/RecentTickets";

function RoleDashboard() {
  const { hasRole } = useAuth();
  if (!hasRole("technician", "admin")) {
    return <Navigate to="/tickets" replace />;
  }
  return <Dashboard />;
}

/** Single parent route with path="/" so child routes reliably render into MainLayout's Outlet. */
function AuthenticatedShell() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-3">
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <MainLayout />;
}

function MainLayout() {
  const navigate = useNavigate();
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    globalSearch,
    setGlobalSearch,
  } = useUI();
  const { user, hasRole } = useAuth();
  const profilePath = user?.id ? `/profiles/${user.id}` : "/tickets";

  const goToTicketsSearch = (e) => {
    e.preventDefault();
    navigate(`/tickets?q=${encodeURIComponent(globalSearch)}`);
  };

  const navClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm transition ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    }`;

  const roleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "technician"
        ? "Technician"
        : "Requester";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-6 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Workspace
            </p>
            <h1 className="mt-1 text-xl font-bold">IT Ticketing</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{roleLabel}</Badge>
            </div>
          </div>

          <nav className="space-y-2">
            {hasRole("technician", "admin") && (
              <NavLink
                to="/"
                end
                className={navClass}
                onClick={() => setIsSidebarOpen(false)}
              >
                Dashboard
              </NavLink>
            )}
            <NavLink
              to="/tickets"
              className={navClass}
              onClick={() => setIsSidebarOpen(false)}
            >
              Tickets
            </NavLink>
            <NavLink
              to="/create-ticket"
              className={navClass}
              onClick={() => setIsSidebarOpen(false)}
            >
              Create Ticket
            </NavLink>
            {user?.id && (
              <NavLink
                to={profilePath}
                className={navClass}
                onClick={() => setIsSidebarOpen(false)}
              >
                My profile
              </NavLink>
            )}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <RecentTickets onNavigate={() => setIsSidebarOpen(false)} />
          </div>
        </aside>

        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        <main className="w-full">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <button
                type="button"
                className="btn-ghost lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                Menu
              </button>

              <form onSubmit={goToTicketsSearch} className="flex-1">
                <input
                  className="input"
                  placeholder="Search tickets..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  aria-label="Search tickets"
                />
              </form>

              <NavLink className="btn-primary" to="/create-ticket">
                Create Ticket
              </NavLink>
              <ProfileMenu />
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthenticatedShell />}>
          <Route index element={<RoleDashboard />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="profiles/:userId" element={<Profile />} />
          <Route path="create-ticket" element={<CreateTicket />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastStack />
    </>
  );
}
