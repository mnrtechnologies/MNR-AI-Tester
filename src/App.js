import { Routes, Route } from "react-router-dom";

import AutomationTesting from "./pages/Dashboard/Testing/AutomationTesting";
import TestHome from "./pages/Dashboard/Testing/TestHome";
import FunctionalTesting from "./pages/Dashboard/Testing/FunctionalTesting";

function App() {
  return (
    <Routes>
      {/* Automation Testing */}
      <Route path="/" element={<TestHome />} />
      <Route path="/automation-testing" element={<AutomationTesting />} />
      <Route path="/functional-testing" element={<FunctionalTesting />} />
    </Routes>
  );
}

export default App;
