function EmptyState({ title, subtitle }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: "#9ca3af"
      }}
    >
      <h4 style={{ marginBottom: 6 }}>{title}</h4>
      <p style={{ fontSize: 13 }}>{subtitle}</p>
    </div>
  );
}

export default EmptyState;
