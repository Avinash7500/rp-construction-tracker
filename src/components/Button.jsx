export default function Button({
  children,
  loading = false,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        opacity: disabled || loading ? 0.7 : 1,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        ...style
      }}
      {...rest}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
