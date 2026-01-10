import Header from "./Header";

function Layout({ children }) {
  return (
    <div>
      <Header />
      <div style={{ padding: 20 }}>
        {children}
      </div>
    </div>
  );
}

export default Layout;
