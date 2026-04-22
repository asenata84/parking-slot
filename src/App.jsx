import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const DEFAULT_PASSWORD = import.meta.env.VITE_PARKING_PASSWORD;
const PARKING_SLOTS_COUNT = parseInt(
  import.meta.env.VITE_PARKING_SLOTS_COUNT || "5",
  10
);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const hasRemote = Boolean(supabase);

const defaultSlots = Array.from(
  { length: PARKING_SLOTS_COUNT },
  (_, index) => ({
    id: index + 1,
    status: "free",
    userId: null,
    userName: null
  })
);

function normalizeSlots(parsedSlots) {
  if (!Array.isArray(parsedSlots)) return defaultSlots;

  return defaultSlots.map((slot, index) => {
    const stored = parsedSlots[index];
    if (!stored) return slot;

    return {
      id: slot.id,
      status: stored.status === "taken" ? "taken" : "free",
      userId: stored.userId || null,
      userName: stored.userName || null
    };
  });
}

function loadSlots() {
  if (typeof window === "undefined") return defaultSlots;

  try {
    const stored = window.localStorage.getItem("parkingSlots");
    if (!stored) return defaultSlots;

    return normalizeSlots(JSON.parse(stored));
  } catch {
    return defaultSlots;
  }
}

function saveSlots(slots) {
  window.localStorage.setItem("parkingSlots", JSON.stringify(slots));
}

function App() {
  const [slots, setSlots] = useState(defaultSlots);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [remoteError, setRemoteError] = useState("");

  useEffect(() => {
    if (!hasRemote) saveSlots(slots);
  }, [slots]);

  useEffect(() => {
    const savedName = localStorage.getItem("parkingUserName");
    if (savedName) setUserName(savedName);
  }, []);

  useEffect(() => {
    if (userName) {
      localStorage.setItem("parkingUserName", userName);
    }
  }, [userName]);

  useEffect(() => {
    const fetchData = async () => {
      if (!hasRemote) {
        setSlots(loadSlots());
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("slots")
        .select("id, status, user_id, user_name")
        .order("id", { ascending: true });

      if (error) {
        setRemoteError(error.message);
        setSlots(loadSlots());
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const initialRows = defaultSlots.map(slot => ({
          id: slot.id,
          status: slot.status,
          user_id: null,
          user_name: null
        }));

        await supabase.from("slots").insert(initialRows);
        setSlots(defaultSlots);
        setIsLoading(false);
        return;
      }

      setSlots(
        data.map(row => ({
          id: row.id,
          status: row.status,
          userId: row.user_id,
          userName: row.user_name
        }))
      );

      setIsLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    const sessionUserId = localStorage.getItem("parkingSessionId");
    if (sessionUserId) {
      setUserId(sessionUserId);
      setIsAuthenticated(true);
    }
  }, []);

  const fetchLatestSlots = async () => {
    if (!hasRemote) return slots;

    const { data, error } = await supabase
      .from("slots")
      .select("id, status, user_id, user_name")
      .order("id", { ascending: true });

    if (error) {
      alert("Грешка при обновяване");
      return null;
    }

    return data.map(row => ({
      id: row.id,
      status: row.status,
      userId: row.user_id,
      userName: row.user_name
    }));
  };

  const handleLogin = () => {
    if (password === DEFAULT_PASSWORD) {
      const newUserId = `user_${Date.now()}`;
      setIsAuthenticated(true);
      setUserId(newUserId);
      localStorage.setItem("parkingSessionId", newUserId);
      setPassword("");
    } else {
      alert("Неправилна парола");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setUserId(null);
    localStorage.removeItem("parkingSessionId");
  };

  if (!isAuthenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>🅿️ Паркоместа</h1>
          <p>Въведете парола за достъп</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyPress={e => e.key === "Enter" && handleLogin()}
            placeholder="Парола"
            className="login-input"
          />
          <button onClick={handleLogin} className="login-button">
            Вход
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-shell">
        <div className="loading-card">Зареждане...</div>
      </div>
    );
  }

  const userSlot = slots.find(slot => slot.userId === userId);

  const takeSlot = async slotId => {
    if (!userName.trim()) {
      alert("Моля въведете име");
      return;
    }

    if (userSlot) {
      alert("Вече имате запазено място.");
      return;
    }

    let latestSlots = slots;

    if (hasRemote) {
      const fresh = await fetchLatestSlots();
      if (!fresh) return;
      latestSlots = fresh;
      setSlots(fresh);
    }

    const target = latestSlots.find(s => s.id === slotId);

    if (!target || target.status === "taken") {
      alert("Мястото току-що беше заето");
      return;
    }

    const updated = latestSlots.map(slot =>
      slot.id === slotId ? { ...slot, status: "taken", userId, userName } : slot
    );

    setSlots(updated);

    if (hasRemote) {
      const { error } = await supabase
        .from("slots")
        .update({
          status: "taken",
          user_id: userId,
          user_name: userName
        })
        .eq("id", slotId)
        .eq("status", "free");

      if (error) {
        alert(error.message);
        setSlots(loadSlots());
      }
    }
  };

  const releaseSlot = async slotId => {
    const slot = slots.find(s => s.id === slotId);

    if (slot.userId !== userId) {
      alert("Не е вашето място");
      return;
    }

    const updated = slots.map(s =>
      s.id === slotId
        ? { ...s, status: "free", userId: null, userName: null }
        : s
    );

    setSlots(updated);

    if (hasRemote) {
      await supabase
        .from("slots")
        .update({ status: "free", user_id: null, user_name: null })
        .eq("id", slotId);
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-content">
          <h1>🅿️ Паркоместа</h1>
          <p>{PARKING_SLOTS_COUNT} служебни места</p>
          {userName && <p>Здравей, {userName}</p>}
        </div>

        <div className="header-actions">
          {!userSlot && (
            <input
              type="text"
              placeholder="Вашето име"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              className="login-input name-input"
            />
          )}

          <button onClick={handleLogout} className="logout-button">
            Изход
          </button>
        </div>
      </header>

      {remoteError && (
        <div className="error-banner">Възникна грешка: {remoteError}</div>
      )}

      <main>
        <div className="slots-grid">
          {slots.map(slot => (
            <div key={slot.id} className={`slot-card ${slot.status}`}>
              <div className="slot-header">
                <strong>Място {slot.id}</strong>
                <span className="status-label">
                  {slot.status === "free" ? "Свободно" : "Заето"}
                </span>
              </div>

              {slot.status === "taken" && slot.userName && (
                <div>👤 {slot.userName}</div>
              )}

              {slot.status === "free" ? (
                <button
                  className="take-button"
                  onClick={() => takeSlot(slot.id)}
                  disabled={!!userSlot}
                >
                  Заеми
                </button>
              ) : slot.userId === userId ? (
                <button
                  className="release-button"
                  onClick={() => releaseSlot(slot.id)}
                >
                  Освободи
                </button>
              ) : (
                <button className="occupied-button" disabled>
                  Заето
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
