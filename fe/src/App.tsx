import AppRouter from "./app/router";
import { ScrollToTop } from "./components/shared";

function App() {
  return (
    <>
      <ScrollToTop />
      <AppRouter />
    </>
  );
}

export default App;
