function SkeletonBox({ height = 40, width = "100%" }) {
  return (
    <div
      style={{
        height,
        width,
        backgroundColor: "#e5e7eb",
        borderRadius: 6,
        marginBottom: 10,
        animation: "pulse 1.5s ease-in-out infinite"
      }}
    />
  );
}

export default SkeletonBox;
