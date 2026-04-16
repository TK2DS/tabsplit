import GuestView from "./pages/GuestView";
import WaiterView from "./pages/WaiterView";

function App() {
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get("table");

  if (tableId) {
    return <GuestView />;
  }

  return <WaiterView />;
}

export default App;