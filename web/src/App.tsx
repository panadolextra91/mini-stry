import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DemoProvider } from "./app/context/DemoContext";
import { PolicyPortal } from "./routes/PolicyPortal";
import { RequestCenter } from "./routes/RequestCenter";
import { Inbox } from "./routes/Inbox";
import { Governance } from "./routes/Governance";

export default function App() {
  return (
    <DemoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/policies" replace />} />
            <Route path="policies" element={<PolicyPortal />} />
            <Route path="requests" element={<RequestCenter />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="governance" element={<Governance />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DemoProvider>
  );
}
