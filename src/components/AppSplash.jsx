export default function AppSplash() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb"
      }}
    >
      <h2>RP Construction Tracker</h2>
      <p style={{ marginTop: 10, color: "#6b7280" }}>
        Checking session…
      </p>
    </div>
  );
}
