import LoginScreen from "./features/auth/LoginScreen";
import Tracker from "./features/tracker/Tracker";
import useAuthUser from "./hooks/useAuthUser";
import { globalCSS } from "./constants/styles";
import LoadingScreen from "./components/ui/LoadingScreen";

export default function App() {
  const { user, checking } = useAuthUser();

  if (checking) {
    return <LoadingScreen fullBackground />;
  }

  return (
    <>
      <style>{globalCSS}</style>
      {user ? <Tracker user={user} /> : <LoginScreen />}
    </>
  );
}
