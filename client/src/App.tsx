import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminApplicationDetail from "./pages/AdminApplicationDetail";
import AdminWorkers from "./pages/AdminWorkers";
import AdminTasks from "./pages/AdminTasks";
import AdminDocuments from "./pages/AdminDocuments";
import AdminAgency from "./pages/AdminAgency";
import AdminClients from "./pages/AdminClients";
import AdminClientDetail from "./pages/AdminClientDetail";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AdminReferrals from "./pages/AdminReferrals";
import ReferrerPortal from "./pages/ReferrerPortal";
import ComponentsShowcase from "./pages/ComponentShowcase";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path={"/"} component={Home} />
      <Route path={"/privacy"} component={PrivacyPolicy} />

      {/* Admin */}
      <Route path={"/admin"} component={AdminLogin} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/admin/application/:id"} component={AdminApplicationDetail} />
      <Route path={"/admin/workers"} component={AdminWorkers} />
      <Route path={"/admin/tasks"} component={AdminTasks} />
      <Route path={"/admin/documents"} component={AdminDocuments} />
      <Route path={"/admin/agency"} component={AdminAgency} />
      <Route path={"/admin/clients"} component={AdminClients} />
      <Route path={"/admin/clients/:id"} component={AdminClientDetail} />
      <Route path={"/admin/referrals"} component={AdminReferrals} />

      {/* Referrer Portal */}
      <Route path={"/referrer"} component={ReferrerPortal} />

      {/* Components Showcase */}
      <Route path={"/components"} component={ComponentsShowcase} />

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
