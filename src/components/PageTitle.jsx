function PageTitle({ title, role, showBack, onBack }) {
  return (
    <div
      style={{
        marginBottom: 20,
        padding: "10px 15px",
        backgroundColor: "#f3f4f6",
        borderRadius: 6,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {role && (
          <small style={{ color: "#6b7280" }}>
            Role: {role}
          </small>
        )}
      </div>

      {showBack && (
        <button onClick={onBack}>Back</button>
      )}
    </div>
  );
}

export default PageTitle;
