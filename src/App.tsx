import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import Contacts from "@/pages/Contacts";
import Scraping from "@/pages/Scraping";
import Dispatch from "@/pages/Dispatch";
import Messages from "@/pages/Messages";
import Pipeline from "@/pages/Pipeline";
import Followup from "@/pages/Followup";
import Agents from "@/pages/Agents";
import Analytics from "@/pages/Analytics";
import ABTest from "@/pages/ABTest";
import Instances from "@/pages/Instances";
import SettingsPage from "@/pages/SettingsPage";
import VoiceProfiles from "@/pages/VoiceProfiles";
import Flows from "@/pages/Flows";
import FlowEditor from "@/pages/FlowEditor";
import Auth from "@/pages/Auth";
import UsersAdmin from "@/pages/UsersAdmin";
import DatabaseInfo from "@/pages/DatabaseInfo";
import Branding from "@/pages/Branding";
import { BrandingProvider } from "@/hooks/useBranding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/scraping" element={<Scraping />} />
              <Route path="/dispatch" element={<Dispatch />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/followup" element={<Followup />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ab-test" element={<ABTest />} />
              <Route path="/instances" element={<Instances />} />
              <Route path="/voice-profiles" element={<VoiceProfiles />} />
              <Route path="/flows" element={<Flows />} />
              <Route path="/flows/:id/edit" element={<FlowEditor />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/users" element={<UsersAdmin />} />
              <Route path="/database-info" element={<DatabaseInfo />} />
              <Route path="/branding" element={<Branding />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
