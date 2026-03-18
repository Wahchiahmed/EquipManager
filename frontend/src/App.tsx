// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "./pages/Login";
import AppLayout from "./components/layout/AppLayout";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import StockDashboard from "./pages/dashboards/StockDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ChatBot from "./components/ChatBot";
import NotFound from "./pages/NotFound";

// ── Employee pages ─────────────────────────────────────────────────────────────
import EmployeeMyRequests from "./pages/Employees/EmployeeMyRequests";
import EmployeeNewRequest from "./pages/Employees/EmployeeNewRequest";
import EmployeeCatalog from "./pages/Employees/EmployeeCatalog";

// ── Admin pages ────────────────────────────────────────────────────────────────
import AdminUsers from "./pages/Admin/AdminUsers";
import AdminDepartements from "./pages/Admin/AdminDepartements";
import AdminProduitsStock from "./pages/Admin/AdminStock";
import AdminToutesLesDemandes from "./pages/Admin/AdminDemande";
import AdminMouvementsStock from "./pages/Admin/AdminMouvementStock";
import AdminAuditHistorique from "./pages/Admin/AdminAuditHistorique";
import InscriptionsTab from "./components/admin/InscriptionsTab";

// ── Manager pages ──────────────────────────────────────────────────────────────
import ManagerPendingRequests from "./pages/Manager/ManagerPendingRequests";
import ManagerAllRequests from "./pages/Manager/ManagerAllRequests";
import ManagerStatistiques from "./pages/Manager/ManagerStatistiques";

// ── Stock pages ────────────────────────────────────────────────────────────────
import StockRequests from "./pages/stock/stockRequests";
import StockAlerts from "./pages/stock/stockAlerts";
import StockProducts from "./pages/stock/stockProducts";
import StockMovements from "./pages/stock/stockMovements";

// ── Profile / Notifications ────────────────────────────────────────────────────
import ProfilePage from "./pages/profile/profilePage";
import NotificationsPage from '@/pages/NotificationsPage';

const queryClient = new QueryClient();

type RoleName =
  | "EMPLOYEE"
  | "RESPONSABLE_DEPARTEMENT"
  | "RESPONSABLE_STOCK"
  | "ADMIN";

const RoleRoute: React.FC<{
  defaultElement: React.ReactNode;
  adminElement: React.ReactNode;
  allowedRoles?: RoleName[];
}> = ({ defaultElement, adminElement, allowedRoles }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role_nom === "ADMIN") return <>{adminElement}</>;
  if (allowedRoles && !allowedRoles.includes(currentUser.role_nom as RoleName))
    return <Navigate to="/dashboard" replace />;
  return <>{defaultElement}</>;
};

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      {children}
      <ChatBot />
    </AppLayout>
  );
};

const DashboardRouter = () => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  switch (currentUser.role_nom) {
    case "EMPLOYEE":                return <EmployeeDashboard />;
    case "RESPONSABLE_DEPARTEMENT": return <ManagerDashboard />;
    case "RESPONSABLE_STOCK":       return <StockDashboard />;
    case "ADMIN":                   return <AdminDashboard />;
    default:                        return <EmployeeDashboard />;
  }
};

// ── Inscriptions page wrapper (standalone route for sidebar link) ───────────────

const InscriptionsPage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Demandes d'inscription</h1>
      <p className="text-muted-foreground text-sm mt-0.5">Validez les demandes d'accès à la plateforme</p>
    </div>
    <InscriptionsTab />
  </div>
);

const AppRoutes = () => {
  const { currentUser } = useAuth();
  return (
    <Routes>
      {/* ── Auth ── */}
      <Route
        path="/login"
        element={currentUser ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/"
        element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />}
      />

      {/* ── Home (role-based) ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedLayout>
            <DashboardRouter />
          </ProtectedLayout>
        }
      />

      {/* ── Employee ── */}
      <Route path="/my-requests" element={<ProtectedLayout><EmployeeMyRequests /></ProtectedLayout>} />
      <Route path="/new-request" element={<ProtectedLayout><EmployeeNewRequest /></ProtectedLayout>} />
      <Route path="/catalog"     element={<ProtectedLayout><EmployeeCatalog /></ProtectedLayout>}    />

      {/* ── Manager ── */}
      <Route path="/pending-requests" element={<ProtectedLayout><ManagerPendingRequests /></ProtectedLayout>} />
      <Route path="/all-requests"     element={<ProtectedLayout><ManagerAllRequests /></ProtectedLayout>}     />
      <Route path="/statistics"       element={<ProtectedLayout><ManagerStatistiques /></ProtectedLayout>}    />

      <Route
        path="/all-requests"
        element={
          <ProtectedLayout>
            <RoleRoute
              allowedRoles={["RESPONSABLE_DEPARTEMENT", "ADMIN"]}
              defaultElement={<ManagerDashboard />}
              adminElement={<AdminToutesLesDemandes />}
            />
          </ProtectedLayout>
        }
      />

      <Route path="/notifications" element={<NotificationsPage />} />

      {/* ── Stock ── */}
      <Route path="/stock-requests" element={<ProtectedLayout><StockRequests /></ProtectedLayout>}  />
      <Route path="/alerts"         element={<ProtectedLayout><StockAlerts />  </ProtectedLayout>}  />

      <Route
        path="/products"
        element={
          <ProtectedLayout>
            <RoleRoute
              allowedRoles={["RESPONSABLE_STOCK", "ADMIN"]}
              defaultElement={<StockProducts />}
              adminElement={<AdminProduitsStock />}
            />
          </ProtectedLayout>
        }
      />
      <Route
        path="/movements"
        element={
          <ProtectedLayout>
            <RoleRoute
              allowedRoles={["RESPONSABLE_STOCK", "ADMIN"]}
              defaultElement={<StockMovements />}
              adminElement={<AdminMouvementsStock />}
            />
          </ProtectedLayout>
        }
      />

      {/* ── Admin-only ── */}
      <Route path="/users"           element={<ProtectedLayout><AdminUsers /></ProtectedLayout>}              />
      <Route path="/departments"     element={<ProtectedLayout><AdminDepartements /></ProtectedLayout>}        />
      <Route path="/produits-stock"  element={<ProtectedLayout><AdminProduitsStock /></ProtectedLayout>}       />
      <Route path="/toutes-demandes" element={<ProtectedLayout><AdminToutesLesDemandes /></ProtectedLayout>}   />
      <Route path="/mouvements-stock"element={<ProtectedLayout><AdminMouvementsStock /></ProtectedLayout>}     />
      <Route path="/audit"           element={<ProtectedLayout><AdminAuditHistorique /></ProtectedLayout>}     />

      {/* ── NEW: Inscriptions (admin-only standalone page + sidebar link) ── */}
      <Route
        path="/inscriptions"
        element={
          <ProtectedLayout>
            <InscriptionsPage />
          </ProtectedLayout>
        }
      />

      {/* ── Shared ── */}
      <Route path="/settings" element={<ProtectedLayout><ProfilePage /></ProtectedLayout>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;