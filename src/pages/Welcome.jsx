import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";

function Welcome() {
  const navigate = useNavigate();

  return (
    <Layout>
      <PageTitle title="Welcome" />

      <p>Select your role</p>

      <button onClick={() => navigate("/admin")}>Admin</button>
      <button onClick={() => navigate("/engineer")} style={{ marginLeft: 10 }}>
        Engineer
      </button>
    </Layout>
  );
}

export default Welcome;
