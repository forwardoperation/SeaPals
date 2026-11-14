import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { prepareDeviceStorage } from "./native.mjs";
import "./styles.css";

class AppBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="boot-error">
      <h1>Let’s get you back to your reef.</h1>
      <p>The game couldn’t open. Your saved data has been kept.</p>
      <button className="primary-button" onClick={() => window.location.reload()}>Try again</button>
    </main>;
    return this.props.children;
  }
}

const root = createRoot(document.getElementById("root"));
try {
  const storage = await prepareDeviceStorage();
  root.render(<React.StrictMode><AppBoundary><App storage={storage} /></AppBoundary></React.StrictMode>);
} catch {
  root.render(<main className="boot-error"><h1>Your save is safe.</h1>
    <p>SeaRealm couldn’t read this device’s saved data. Nothing has been replaced. Please try opening the app again.</p>
    <button className="primary-button" onClick={() => window.location.reload()}>Try again</button>
  </main>);
}
