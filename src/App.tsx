import React, { useState, useEffect } from "react";
import { ErpProvider } from "./context/ErpContext";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('erp_auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <ErpProvider>
      {isAuthenticated ? (
        <Layout />
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </ErpProvider>
  );
}
