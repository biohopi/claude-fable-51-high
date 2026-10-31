"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Expand,
  Globe2,
  Headphones,
  HelpCircle,
  KeyRound,
  MapPin,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings2,
  Shield,
  SlidersHorizontal,
  Trophy,
  UsersRound,
  Volume2,
  VolumeX,
  Warehouse,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Brand, { Emblem } from "./Brand";
import Dialog from "./Dialog";
import Loadout from "./Loadout";
import Armory from "./Armory";
import TacticalMap, { type MapId } from "./TacticalMap";
import {
  DEFAULT_INVENTORY,
  DEFAULT_SETTINGS,
  readSaved,
  type GameSettings,
  type Inventory,
} from "../game/data";

type Panel =
  | "loadout"
  | "armory"
  | "guide"
  | "settings"
  | "map"
  | "profile"
  | "rooms"
  | "leaderboard"
  | null;
type Online = "offline" | "create" | "join";

const MAP_META: Record<MapId, { title: string; subtitle: string; mode: string; blurb: string; facts: string }> = {
  WAREHOUSE: {
    title: "WAREHOUSE",
    subtitle: "Team Deathmatch arena",
    mode: "TEAM DEATHMATCH",
    blurb: "A tight, symmetric container yard with a central hall. Instant respawns, full loadouts, first team to the kill limit wins.",
    facts: "RESPAWNS / FIRST TO 40 / 10 MIN",
  },
  ERANGEL: {
    title: "ERANGEL",
    subtitle: "The classic battleground",
    mode: "TEAM BATTLE ROYALE",
    blurb: "An open-world fight for survival. Explore towns, find your gear, and outlast the closing zone as a team.",
    facts: "180+ BUILDINGS / DYNAMIC ZONE",
  },
};

interface OpenRoom { code: string; map: string; host: string; players: number; slots: number; bots: number }
interface LeaderRow { callsign: string; matches: number; wins: number; kills: number; deaths: number }

function App() {
  const [panel, setPanel] = useState<Panel>(null);
  const [inventory, setInventory] = useState<Inventory>(() => readSaved("erangel-inventory-v1", DEFAULT_INVENTORY));
  const [settings, setSettings] = useState<GameSettings>(() => readSaved("erangel-settings-v1", DEFAULT_SETTINGS));
  const [name, setName] = useState(() => readSaved("erangel-player-name", "GHOST_01"));
  const [nameDraft, setNameDraft] = useState(name);
  const [map, setMapState] = useState<MapId>(() => readSaved<MapId>("erangel-map-v2", "WAREHOUSE"));
  const [mapDraft, setMapDraft] = useState<MapId>(map);
  const [playing, setPlaying] = useState(false);
  const [online, setOnline] = useState<Online>("offline");
  const [roomCode, setRoomCode] = useState("");
  const [joinDraft, setJoinDraft] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState("");
  const [guideTab, setGuideTab] = useState<"MOVEMENT" | "COMBAT" | "LOOT & GEAR">("MOVEMENT");
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sendToGame = useCallback(
    (data: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage({ source: "erangel-lobby", ...data }, location.origin),
    [],
  );
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 3200);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(null);
    if (playing) sendToGame({ type: "resume" });
  }, [playing, sendToGame]);
  const changeInventory = useCallback(
    (value: Inventory) => {
      setInventory(value);
      sendToGame({ type: "inventory", inventory: value });
    },
    [sendToGame],
  );
  const setMap = (value: MapId) => {
    setMapState(value);
    localStorage.setItem("erangel-map-v2", JSON.stringify(value));
  };

  useEffect(() => { localStorage.setItem("erangel-inventory-v1", JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => {
    localStorage.setItem("erangel-settings-v1", JSON.stringify(settings));
    sendToGame({ type: "settings", settings });
  }, [settings, sendToGame]);
  useEffect(() => { localStorage.setItem("erangel-player-name", JSON.stringify(name)); }, [name]);
  useEffect(() => () => clearTimeout(toastTimeout.current), []);

  // Invite links (/?room=CODE) jump straight into the room join flow.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code && /^[A-Z0-9]{4,8}$/i.test(code)) {
      setJoinDraft(code.toUpperCase());
      setRoomCode(code.toUpperCase());
      setOnline("join");
      setDeploying(true);
      setPlaying(true);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== "erangel-game") return;
      if (event.data.inventory) setInventory(event.data.inventory as Inventory);
      if (event.data.type === "ready") {
        setDeploying(false);
        sendToGame({ type: "initialize", inventory, settings, name, map, online, room: roomCode });
      }
      if (event.data.type === "inventory-open") setPanel("loadout");
      if (event.data.type === "settings-open") setPanel("settings");
      if (event.data.type === "settings-sync") setSettings(event.data.settings as GameSettings);
      if (event.data.type === "return-lobby") {
        setPlaying(false);
        setDeploying(false);
        setPanel(null);
        try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
      }
      if (event.data.type === "error") {
        setDeploying(false);
        setPlaying(false);
        notify(event.data.message || "Unable to start WebGL. Please try another browser.");
      }
    };
    addEventListener("message", handler);
    return () => removeEventListener("message", handler);
  }, [inventory, settings, name, map, online, roomCode, sendToGame, notify]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (playing || panel || ["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) return;
      if (event.code === "KeyB") { event.preventDefault(); setPanel("loadout"); }
      if (event.key === "?") setPanel("guide");
      if (event.code === "KeyV") setSettings((previous: GameSettings) => ({ ...previous, perspective: previous.perspective === "TPP" ? "FPP" : "TPP" }));
    };
    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey);
  }, [playing, panel]);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      const data = (await response.json()) as { rooms?: OpenRoom[] };
      setRooms(data.rooms || []);
    } catch { setRooms([]); }
    setRoomsLoading(false);
  }, []);
  const loadLeaders = useCallback(async () => {
    setLeadersLoading(true);
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = (await response.json()) as { players?: LeaderRow[] };
      setLeaders(data.players || []);
    } catch { setLeaders([]); }
    setLeadersLoading(false);
  }, []);
  useEffect(() => {
    if (panel === "rooms") { loadRooms(); const timer = setInterval(loadRooms, 4000); return () => clearInterval(timer); }
    if (panel === "leaderboard") loadLeaders();
  }, [panel, loadRooms, loadLeaders]);

  const openPanel = (value: Panel) => {
    if (value === "map") setMapDraft(map);
    if (value === "profile") setNameDraft(name);
    setPanel(value);
    if (playing) sendToGame({ type: "pause" });
  };
  const launch = (mode: Online, code = "") => {
    setOnline(mode);
    setRoomCode(code);
    setPanel(null);
    setDeploying(true);
    setPlaying(true);
  };
  const joinWithCode = () => {
    const code = joinDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) { notify("Enter the room code your friend shared."); return; }
    launch("join", code);
  };
  const leaveMatch = () => {
    sendToGame({ type: "stop" });
    setPlaying(false);
    setDeploying(false);
    setPanel(null);
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { notify("Fullscreen is not available in this browser."); }
  };

  const meta = MAP_META[map];

  return (
    <div className={`app ${playing ? "in-match" : ""}`}>
      {!playing && (
        <>
          <div className="lobby-scene" aria-hidden="true">
            <motion.img
              src={map === "WAREHOUSE" ? "/images/warehouse-lobby.jpg" : "/images/erangel-lobby.jpg"}
              alt=""
              initial={{ scale: 1.045, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ scale: { duration: 18, ease: "easeOut" }, opacity: { duration: 1 } }}
              key={map}
            />
            <div className="scene-shade" />
            <div className="film-grain" />
          </div>
          <motion.header className="topbar" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <button className="brand-button" onClick={() => setPanel(null)} aria-label="Erangel Strike home">
              <Brand />
            </button>
            <nav className="main-nav" aria-label="Main navigation">
              {(["PLAY", "LOADOUT", "ARMORY", "FIELD GUIDE", "RANKINGS"] as const).map((label, index) => (
                <button
                  key={label}
                  className={index === 0 ? "active" : ""}
                  onClick={() =>
                    index === 0 ? setPanel(null) : openPanel(index === 1 ? "loadout" : index === 2 ? "armory" : index === 3 ? "guide" : "leaderboard")
                  }
                >
                  {label}
                  {label === "LOADOUT" && <span className="nav-new-dot" />}
                </button>
              ))}
            </nav>
            <div className="header-tools">
              <button className="icon-button sound-button" aria-label={settings.muted ? "Unmute game audio" : "Mute game audio"} onClick={() => setSettings({ ...settings, muted: !settings.muted })}>
                {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button className="icon-button" aria-label="Open settings" onClick={() => openPanel("settings")}>
                <Settings2 size={19} />
              </button>
              <span className="header-divider" />
              <button className="player-button" onClick={() => openPanel("profile")}>
                <span className="player-avatar"><Emblem /></span>
                <span>
                  <strong>{name}</strong>
                  <span>OPERATIVE <i /></span>
                </span>
                <ChevronDown size={13} />
              </button>
            </div>
          </motion.header>
          <main className="lobby-main">
            <motion.div className="hero-copy" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.22 } } }}>
              <motion.div className="hero-eyebrow" variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}>
                <span /> {map === "WAREHOUSE" ? "TEAM DEATHMATCH · ONLINE & OFFLINE" : "THE ORIGINAL BATTLEGROUND"}
              </motion.div>
              <motion.h1 variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.65 }}>
                ERANGEL<span>STRIKE</span>
              </motion.h1>
              <motion.div className="hero-description" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
                <h2>{map === "WAREHOUSE" ? "BLUE VS RED. FIRST TO FORTY." : "EVERY DROP. A NEW STORY."}</h2>
                <p>
                  {map === "WAREHOUSE" ? "Build both teams with + and −, invite friends with a room code," : "Gear up. Trust your instincts."}
                  <br />
                  {map === "WAREHOUSE" ? "then fight it out in the container yard." : "Be the last team standing."}
                </p>
              </motion.div>
              <motion.button className="loadout-link" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} onClick={() => openPanel("loadout")}>
                <Backpack size={17} />
                <span>PREPARE YOUR LOADOUT</span>
                <ArrowRight size={16} />
              </motion.button>
            </motion.div>
            <div className="ambient-dust" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <i key={index} style={{ left: `${36 + index * 10}%`, animationDelay: `${index * -2.7}s`, animationDuration: `${12 + index * 3}s` }} />
              ))}
            </div>
            <motion.div className="match-dock" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.65 }}>
              <button className="map-selection" onClick={() => openPanel("map")}>
                <div className="map-thumbnail">
                  <TacticalMap map={map} />
                  <span className="map-pin"><MapPin size={15} /></span>
                </div>
                <div>
                  <span className="field-label">SELECTED MAP</span>
                  <strong>{meta.title}</strong>
                  <span className="map-subtitle">{meta.subtitle}</span>
                </div>
                <ChevronDown size={17} />
              </button>
              <div className="match-options">
                <div className="mode-heading">
                  <span className="field-label">GAME MODE</span>
                  <span className="local-match"><span /> TWO TEAMS · ALWAYS ON</span>
                </div>
                <div className="mode-controls">
                  <span className="battle-royale">{meta.mode}</span>
                  <div className="mode-segment teams-segment" aria-label="Teams">
                    <span className="team-chip blue">BLUE</span>
                    <span className="team-vs">VS</span>
                    <span className="team-chip red">RED</span>
                  </div>
                  <div className="perspective-segment" aria-label="Camera perspective">
                    {(["TPP", "FPP"] as const).map((value) => (
                      <button key={value} aria-pressed={settings.perspective === value} className={settings.perspective === value ? "selected" : ""} onClick={() => setSettings({ ...settings, perspective: value })} title={value === "TPP" ? "Third-person perspective" : "First-person perspective"}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="online-row">
                  <button className="text-button online-create" onClick={() => launch("create")}>
                    <Plus size={15} /> CREATE ROOM
                  </button>
                  <form className="join-form" onSubmit={(event) => { event.preventDefault(); joinWithCode(); }}>
                    <KeyRound size={14} />
                    <input aria-label="Room code" value={joinDraft} maxLength={8} placeholder="ROOM CODE" onChange={(event) => setJoinDraft(event.target.value.toUpperCase())} />
                    <button type="submit">JOIN</button>
                  </form>
                  <button className="text-button" onClick={() => openPanel("rooms")}>
                    <Globe2 size={15} /> OPEN ROOMS
                  </button>
                </div>
              </div>
              <div className="deploy-group">
                <button className="deploy-button" onClick={() => launch("offline")}>
                  <span className="deploy-icon"><Crosshair size={23} /></span>
                  <span>DEPLOY</span>
                  <ArrowRight size={24} />
                </button>
                <span className="deploy-caption">SET PLAYERS & BOTS PER TEAM BEFORE THE MATCH</span>
                <button className="multiplayer-button" onClick={() => launch("create")}>
                  <UsersRound size={17} /> HOST ONLINE ROOM <ArrowRight size={17} />
                </button>
              </div>
            </motion.div>
          </main>
          <footer className="lobby-footer">
            <div className="system-status">
              <span /> SYSTEMS READY <i /> <Globe2 size={12} /> {map === "WAREHOUSE" ? "WAREHOUSE ARENA" : "ERANGEL REGION"} <i /> LAN + ONLINE ROOMS
            </div>
            <div className="keyboard-shortcuts">
              <button onClick={() => openPanel("loadout")}><kbd>B</kbd> BACKPACK</button>
              <button onClick={() => openPanel("guide")}><kbd>?</kbd> CONTROLS</button>
              <button onClick={fullscreen}><Expand size={12} /> FULLSCREEN</button>
            </div>
            <span className="build-version">ENHANCED <span>V.2.0.0</span></span>
          </footer>
        </>
      )}
      {playing && (
        <div className="game-shell">
          <header className="game-topbar">
            <Brand compact />
            <span className="game-session">
              <Radio size={13} /> {meta.title} / {meta.mode} / {online === "offline" ? "LOCAL SESSION" : online === "create" ? "HOSTING ROOM" : `ROOM ${roomCode}`}
            </span>
            <div>
              <button className="text-button" onClick={() => openPanel("loadout")}><Backpack size={16} /> BACKPACK</button>
              <button className="icon-button" aria-label="Match settings" onClick={() => openPanel("settings")}><Settings2 size={18} /></button>
              <button className="return-lobby" onClick={leaveMatch}><ArrowLeft size={15} /> RETURN TO LOBBY</button>
            </div>
          </header>
          <iframe ref={frame} className="game-frame" title="Erangel Strike playable battleground" src="/game/index.html" allow="autoplay; fullscreen" />
          {deploying && (
            <div className="deployment-screen">
              <div className="deploy-spinner" />
              <span>{online === "offline" ? "PREPARING THE ARENA" : online === "create" ? "OPENING YOUR ROOM" : `CONNECTING TO ROOM ${roomCode}`}</span>
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {panel && (
          <Dialog onClose={closePanel} className={`dialog-${panel}`} label={`${panel} panel`}>
            {panel === "loadout" && <Loadout inventory={inventory} onChange={changeInventory} onClose={closePanel} />}
            {panel === "armory" && <Armory inventory={inventory} onChange={changeInventory} onClose={closePanel} onLoadout={() => setPanel("loadout")} />}
            {panel === "settings" && (
              <section className="settings-content">
                <PanelHeading eyebrow="MAKE IT YOURS" title="SETTINGS" description="Fine-tune your field experience." onClose={closePanel} />
                <div className="settings-section">
                  <h3><Headphones size={17} /> AUDIO</h3>
                  <label className="range-setting">
                    <span>Master volume<small>Only active, nearby shooters produce gunfire.</small></span>
                    <input aria-label="Master volume" type="range" min="0" max="100" value={settings.volume} onChange={(e) => setSettings({ ...settings, volume: +e.target.value })} />
                    <b>{settings.volume}%</b>
                  </label>
                  <label className="toggle-setting">
                    <span>Mute all audio</span>
                    <input type="checkbox" checked={settings.muted} onChange={(e) => setSettings({ ...settings, muted: e.target.checked })} />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="settings-section">
                  <h3><SlidersHorizontal size={17} /> CONTROLS</h3>
                  <label className="range-setting">
                    <span>Mouse sensitivity<small>Precision starts with the right feel.</small></span>
                    <input aria-label="Mouse sensitivity" type="range" min="10" max="100" value={settings.sensitivity} onChange={(e) => setSettings({ ...settings, sensitivity: +e.target.value })} />
                    <b>{settings.sensitivity}%</b>
                  </label>
                  <div className="toggle-setting">
                    <span>Default perspective</span>
                    <div className="perspective-segment">
                      {(["TPP", "FPP"] as const).map((value) => (
                        <button key={value} className={settings.perspective === value ? "selected" : ""} onClick={() => setSettings({ ...settings, perspective: value })}>{value}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3><Monitor size={17} /> GRAPHICS</h3>
                  <label className="toggle-setting">
                    <span>Dynamic shadows<small>Disable for smoother play on older devices.</small></span>
                    <input type="checkbox" checked={settings.shadows} onChange={(e) => setSettings({ ...settings, shadows: e.target.checked })} />
                    <span className="toggle-track" />
                  </label>
                </div>
                <div className="panel-footer">
                  <button className="text-button" onClick={() => setSettings({ ...DEFAULT_SETTINGS })}><RotateCcw size={14} /> RESTORE DEFAULTS</button>
                  <button className="amber-button small" onClick={closePanel}>SAVE & CLOSE <Check size={16} /></button>
                </div>
              </section>
            )}
            {panel === "map" && (
              <section className="map-content">
                <PanelHeading eyebrow="PICK YOUR BATTLEGROUND" title="THE DROPZONE" description="Two teams, always. Choose where they meet." onClose={closePanel} />
                <div className="dropzone-layout">
                  <div className="large-map">
                    <TacticalMap large map={mapDraft} />
                    <span><MapPin size={14} /> {mapDraft === "WAREHOUSE" ? "WAREHOUSE · CONTAINER YARD" : "ERANGEL ISLAND"}</span>
                  </div>
                  <div className="dropzone-choices">
                    {(["WAREHOUSE", "ERANGEL"] as const).map((value) => (
                      <button className={mapDraft === value ? "selected" : ""} key={value} onClick={() => setMapDraft(value)}>
                        {value === "WAREHOUSE" ? <Warehouse size={23} /> : <Globe2 size={23} />}
                        <div>
                          <h3>{MAP_META[value].title} <small>· {MAP_META[value].mode}</small></h3>
                          <p>{MAP_META[value].blurb}</p>
                          <span>{MAP_META[value].facts}</span>
                        </div>
                        {mapDraft === value && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="panel-footer">
                  <span><Shield size={14} /> PLAYABLE OFFLINE, ON YOUR LAN, OR ONLINE.</span>
                  <button className="amber-button small" onClick={() => { setMap(mapDraft); closePanel(); }}>
                    CONFIRM DROPZONE <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}
            {panel === "rooms" && (
              <section className="rooms-content">
                <PanelHeading eyebrow="FIND YOUR SQUAD" title="OPEN ROOMS" description="Public rooms waiting for players on this server." onClose={closePanel} />
                <div className="rooms-toolbar">
                  <form className="join-form large" onSubmit={(event) => { event.preventDefault(); joinWithCode(); }}>
                    <KeyRound size={15} />
                    <input aria-label="Room code" value={joinDraft} maxLength={8} placeholder="ENTER A ROOM CODE" onChange={(event) => setJoinDraft(event.target.value.toUpperCase())} />
                    <button type="submit">JOIN</button>
                  </form>
                  <button className="text-button" onClick={loadRooms}><RefreshCw size={14} className={roomsLoading ? "spin" : ""} /> REFRESH</button>
                </div>
                <div className="rooms-list">
                  {rooms.length === 0 && (
                    <div className="rooms-empty">
                      {roomsLoading ? "Looking for rooms…" : "No public rooms right now. Create one and share the code — friends on your Wi-Fi can also open this site using your computer's LAN address."}
                    </div>
                  )}
                  {rooms.map((room) => (
                    <button className="room-row" key={room.code} onClick={() => launch("join", room.code)}>
                      <strong>{room.code}</strong>
                      <span>{room.map === "ERANGEL" ? "ERANGEL · BR" : "WAREHOUSE · TDM"}</span>
                      <span>HOST {room.host}</span>
                      <span>{room.players}/{Math.max(room.slots, room.players)} PLAYERS · {room.bots} BOTS</span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="panel-footer">
                  <span><UsersRound size={14} /> ROOMS LIVE IN SERVER MEMORY UNTIL EVERYONE LEAVES.</span>
                  <button className="amber-button small" onClick={() => launch("create")}>CREATE A ROOM <Plus size={16} /></button>
                </div>
              </section>
            )}
            {panel === "leaderboard" && (
              <section className="rooms-content">
                <PanelHeading eyebrow="HALL OF OPERATIVES" title="RANKINGS" description="Results from completed online matches on this server." onClose={closePanel} />
                <div className="rooms-list leaderboard">
                  {leaders.length === 0 && <div className="rooms-empty">{leadersLoading ? "Loading rankings…" : "No online matches recorded yet. Finish a room match to appear here."}</div>}
                  {leaders.map((row, index) => (
                    <div className="room-row static" key={row.callsign}>
                      <strong>#{index + 1} {row.callsign}</strong>
                      <span>{row.wins} W / {row.matches} M</span>
                      <span>{row.kills} KILLS</span>
                      <span>K/D {(row.kills / Math.max(1, row.deaths)).toFixed(2)}</span>
                      <Trophy size={16} />
                    </div>
                  ))}
                </div>
                <div className="panel-footer">
                  <span><Shield size={14} /> OFFLINE MATCHES ARE NOT RANKED.</span>
                  <button className="text-button" onClick={loadLeaders}><RefreshCw size={14} /> REFRESH</button>
                </div>
              </section>
            )}
            {panel === "guide" && (
              <section className="guide-content">
                <PanelHeading eyebrow="KNOW THE BATTLEGROUND" title="FIELD GUIDE" description="A little preparation goes a long way." onClose={closePanel} />
                <div className="guide-tabs">
                  {(["MOVEMENT", "COMBAT", "LOOT & GEAR"] as const).map((tab) => (
                    <button className={guideTab === tab ? "selected" : ""} onClick={() => setGuideTab(tab)} key={tab}>{tab}</button>
                  ))}
                </div>
                <div className="controls-list">
                  {(guideTab === "MOVEMENT"
                    ? [
                        ["W A S D", "Move", "Navigate the arena and explore buildings."],
                        ["MOUSE", "Look around", "Click the game to capture your cursor. Press Escape to release."],
                        ["SHIFT", "Sprint", "Hold while moving forward to pick up speed."],
                        ["SPACE", "Jump", "Clear obstacles and climb onto containers."],
                        ["C", "Crouch", "Lower your profile and steady your aim."],
                        ["V", "Change perspective", "Switch between first-person and third-person views."],
                      ]
                    : guideTab === "COMBAT"
                      ? [
                          ["LMB", "Fire weapon", "Hold for automatic fire on compatible weapons."],
                          ["RMB", "Aim down sights", "Look through your equipped optic with real magnification."],
                          ["R", "Reload", "Refill your magazine from backpack ammunition."],
                          ["1 / 2", "Select main weapon", "Switch only between your two equipped main weapons."],
                          ["Q", "Quick switch", "Cycle between your primary and secondary weapons."],
                          ["H", "First aid", "Use a first aid kit to restore 50 health."],
                        ]
                      : [
                          ["F", "Pick up loot", "Collect weapons, scopes, ammunition, and first aid."],
                          ["B / TAB", "Open backpack", "Keep as many weapons as you can find. No capacity limit."],
                          ["TDM", "Full loadout", "In Warehouse you spawn with your equipped weapons and full ammo."],
                          ["ROOMS", "Play with friends", "Create a room, share the code or invite link, set players and bots per team with + / −."],
                          ["AUTO", "Ammo & first aid", "Small supplies are collected automatically when you walk over them."],
                          ["ESC", "Release cursor", "Open your backpack or use the on-screen pause button."],
                        ]
                  ).map(([key, title, desc]) => (
                    <div className="control-row" key={title}>
                      <kbd>{key}</kbd>
                      <div><h3>{title}</h3><p>{desc}</p></div>
                      <ChevronRight size={15} />
                    </div>
                  ))}
                </div>
                <div className="guide-tip">
                  <HelpCircle size={19} />
                  <p>
                    {guideTab === "LOOT & GEAR"
                      ? "Friends on the same Wi-Fi can join by opening this site at your computer's LAN address (shown in the terminal when the server starts)."
                      : guideTab === "COMBAT"
                        ? "Gunfire is positional. Listen carefully: every shot comes from a real, active combatant in your match."
                        : "In Warehouse you can climb the central hall catwalks and the stacked containers for high ground."}
                  </p>
                </div>
              </section>
            )}
            {panel === "profile" && (
              <section className="profile-content">
                <PanelHeading eyebrow="YOUR FIELD IDENTITY" title="OPERATIVE" description="A name the battleground will remember." onClose={closePanel} />
                <div className="profile-emblem"><Emblem /></div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = nameDraft.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
                    if (value) { setName(value); closePanel(); notify("Operative identity updated."); }
                  }}
                >
                  <label className="profile-name">
                    CALLSIGN
                    <input autoComplete="off" value={nameDraft} maxLength={16} onChange={(event) => setNameDraft(event.target.value)} required pattern="[a-zA-Z0-9_]+" aria-label="Operative callsign" />
                  </label>
                  <p className="profile-hint">Up to 16 letters, numbers, or underscores. Shown to everyone in your room.</p>
                  <button className="amber-button" type="submit">SAVE CALLSIGN <Check size={17} /></button>
                </form>
              </section>
            )}
          </Dialog>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div role="status" className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <Check size={16} />
            {toast}
            <button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PanelHeading({ eyebrow, title, description, onClose }: { eyebrow: string; title: string; description: string; onClose: () => void }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="eyebrow"><span className="tiny-line" /> {eyebrow}</span>
        <h2>{title}<span className="heading-dot">.</span></h2>
        <p>{description}</p>
      </div>
      <button className="icon-button close-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
        <X size={22} />
      </button>
    </div>
  );
}

export default App;
