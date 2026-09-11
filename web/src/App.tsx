import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import CoinPage from "./pages/Coin";
import Watchlist from "./pages/Watchlist";
import Analyst from "./pages/Analyst";
import Status from "./pages/Status";
import Shared from "./pages/Shared";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="coin/:id" element={<CoinPage />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="analyst" element={<Analyst />} />
        <Route path="status" element={<Status />} />
        <Route path="s/:id" element={<Shared />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
