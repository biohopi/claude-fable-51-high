"use client";

import dynamic from "next/dynamic";

// The lobby reads localStorage and talks to the game iframe, so it is rendered on the client only.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="boot-screen">
      <div className="deploy-spinner" />
      <span>LOADING ERANGEL STRIKE</span>
    </div>
  ),
});

export default function LobbyLoader() {
  return <App />;
}
