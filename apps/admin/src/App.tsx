import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import TablesPage from "./pages/TablesPage";
import QueriesPage from "./pages/QueriesPage";
import SchemaPage from "./pages/SchemaPage";
import DocsPage from "./pages/DocsPage";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";

const AppContent = () => {
  const { pathname } = useLocation();
  const isDocs = pathname === "/docs";

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo">Admin</span>
        <div className="nav-links">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Settings
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Docs
          </NavLink>
          <NavLink
            to="/tables"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Tables
          </NavLink>
          <NavLink
            to="/queries"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Queries
          </NavLink>
          <NavLink
            to="/schema"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Schema
          </NavLink>
        </div>
      </nav>
      <main className={isDocs ? "main main--bare" : "main"}>
        <Routes>
          <Route path="/" element={<Navigate to="/tables" replace />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/queries" element={<QueriesPage />} />
          <Route path="/schema" element={<SchemaPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
