import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import { showSuccess } from "../utils/showSuccess";

export default function ReportsAdvanced() {
  const navigate = useNavigate();

  useEffect(() => {
    // ReportsAdvanced was merged into /admin/reports to remove duplicate reporting surfaces.
    showSuccess("Advanced report view has been merged into Reports");
    navigate("/admin/reports", { replace: true });
  }, [navigate]);

  return <Layout />;
}
