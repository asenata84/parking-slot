import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const DEFAULT_PASSWORD = import.meta.env.VITE_PARKING_PASSWORD;
const PARKING_SLOTS_COUNT = parseInt(
  import.meta.env.VITE_PARKING_SLOTS_COUNT || "5",
  10
);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
    userId: null
  })
);

function normalizeSlots(parsedSlots) {
  if (!Array.isArray(parsedSlots)) {
    return defaultSlots;
  }

  return defaultSlots.map((slot, index) => {
    const stored = parsedSlots[index];
    if (!stored) {
      return slot;
    }

    return {
      id: slot.id,
      status: stored.status === "taken" ? "taken" : "free",
      userId: stored.userId || null
    };
  });
}

function loadSlots() {
  if (typeof window === "undefined") {
    return defaultSlots;
  }

  try {
    const stored = window.localStorage.getItem("parkingSlots");
    if (!stored) {
      return defaultSlots;
    }

    const parsed = JSON.parse(stored);
    return normalizeSlots(parsed);
  } catch (error) {
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
  const [isLoading, setIsLoading] = useState(true);
  const [remoteError, setRemoteError] = useState("");

  useEffect(() => {
    if (!hasRemote) {
      saveSlots(slots);
    }
  }, [slots]);

  useEffect(() => {
    const fetchLocalOrRemote = async () => {
      if (!hasRemote) {
        setSlots(loadSlots());
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("slots")
        .select("id, status, user_id")
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
          user_id: slot.userId
        }));
        const { error: insertError } = await supabase
          .from("slots")
          .insert(initialRows);
        if (insertError) {
          setRemoteError(insertError.message);
          setSlots(loadSlots());
          setIsLoading(false);
          return;
        }
        setSlots(defaultSlots);
        setIsLoading(false);
        return;
      }

      setSlots(
        defaultSlots.map(slot => {
          const stored = data.find(row => row.id === slot.id);
          return stored
            ? { id: stored.id, status: stored.status, userId: stored.user_id }
            : slot;
        })
      );
      setIsLoading(false);
    };

    fetchLocalOrRemote();
  }, []);

  useEffect(() => {
    const handleStorageChange = event => {
      if (event.key === "parkingSlots") {
        setSlots(loadSlots());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    // Check if there's an active session
    const sessionUserId = localStorage.getItem("parkingSessionId");
    if (sessionUserId) {
      setUserId(sessionUserId);
      setIsAuthenticated(true);
    }
  }, []);

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

  const takeSlot = slotId => {
    if (userSlot) {
      alert("Вече имате запазено място. Първо го освободете.");
      return;
    }

    const updatedSlots = slots.map(slot =>
      slot.id === slotId ? { ...slot, status: "taken", userId } : slot
    );
    setSlots(updatedSlots);
    if (hasRemote) {
      supabase
        .from("slots")
        .update({ status: "taken", user_id: userId })
        .eq("id", slotId)
        .then(({ error }) => {
          if (error) {
            alert(error.message);
            setSlots(loadSlots());
          }
        });
    }
  };

  const releaseSlot = slotId => {
    const slot = slots.find(s => s.id === slotId);
    if (slot.userId !== userId) {
      alert("Можете да освободите само място, което сами сте заели");
      return;
    }

    const updatedSlots = slots.map(slot =>
      slot.id === slotId ? { ...slot, status: "free", userId: null } : slot
    );
    setSlots(updatedSlots);
    if (hasRemote) {
      supabase
        .from("slots")
        .update({ status: "free", user_id: null })
        .eq("id", slotId)
        .then(({ error }) => {
          if (error) {
            alert(error.message);
            setSlots(loadSlots());
          }
        });
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-content">
          <h1>🅿️ Паркоместа</h1>
          <p>{PARKING_SLOTS_COUNT} служебни места</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Изход
        </button>
      </header>

      {remoteError && (
        <div className="error-banner">
          Възникна грешка при сървърната връзка: {remoteError}
        </div>
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
