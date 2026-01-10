import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Engineer from "./pages/Engineer";
import Welcome from "./pages/Welcome";

function App() {
  return (
    <Routes>
      {/* Login */}
      <Route path="/" element={<Login />} />

      {/* Optional welcome */}
      <Route path="/welcome" element={<Welcome />} />

      {/* Role based pages */}
      <Route path="/admin" element={<Admin />} />
      <Route path="/engineer" element={<Engineer />} />
    </Routes>
  );
}

export default App;
