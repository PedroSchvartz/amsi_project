import { useNavigate } from "react-router-dom";
import Home from "./Home";
const navigate = useNavigate();
function HomePage() {
  return <Home />;
}

export default HomePage;