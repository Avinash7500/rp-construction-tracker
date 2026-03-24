import AccountantShell from "../components/AccountantShell";

export default function AccountantSettings() {
  return (
    <AccountantShell title="Settings" subtitle="Accountant workspace preferences">
      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Settings</h3>
        </div>
        <div className="acc-card-body">
          <p style={{ marginTop: 0, color: "#475569" }}>
            Settings placeholders are enabled for future accounting controls.
          </p>
          <ul style={{ marginBottom: 0, color: "#64748b" }}>
            <li>Default report format</li>
            <li>Financial approval thresholds</li>
            <li>Notification preferences</li>
          </ul>
        </div>
      </section>
    </AccountantShell>
  );
}
