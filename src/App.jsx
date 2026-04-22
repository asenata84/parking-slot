import { useEffect, useState } from "react";
import "./App.css";

const defaultSlots = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  status: "free",
  owner: ""
}));

function loadSlots() {
  if (typeof window === "undefined") {
    return defaultSlots;
  }

  try {
    const stored = window.localStorage.getItem("parkingSlots");
    return stored ? JSON.parse(stored) : defaultSlots;
  } catch (error) {
    return defaultSlots;
  }
}

function saveSlots(slots) {
  window.localStorage.setItem("parkingSlots", JSON.stringify(slots));
}

function App() {
  const [slots, setSlots] = useState(loadSlots);
  const [ownerNames, setOwnerNames] = useState(
    defaultSlots.reduce((acc, slot) => ({ ...acc, [slot.id]: "" }), {})
  );

  useEffect(() => {
    saveSlots(slots);
  }, [slots]);

  const reserveSlot = slotId => {
    const name = ownerNames[slotId]?.trim();
    if (!name) {
      alert("Моля, въведете име на служител");
      return;
    }

    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.id === slotId ? { ...slot, status: "taken", owner: name } : slot
      )
    );
    setOwnerNames(prev => ({ ...prev, [slotId]: "" }));
  };

  const releaseSlot = slotId => {
    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.id === slotId ? { ...slot, status: "free", owner: "" } : slot
      )
    );
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-content">
          <h1>🅿️ Паркоместа</h1>
          <p>5 служебни места</p>
        </div>
      </header>

      <main>
        <div className="slots-grid">
          {slots.map(slot => (
            <div key={slot.id} className={`slot-card ${slot.status}`}>
              <div className="slot-header">
                <strong>Място {slot.id}</strong>
                <span className="status-label">
                  {slot.status === "free"
                    ? "Свободно"
                    : `Заето от ${slot.owner}`}
                </span>
              </div>

              {slot.status === "free" ? (
                <>
                  <input
                    type="text"
                    value={ownerNames[slot.id] || ""}
                    onChange={event =>
                      setOwnerNames(prev => ({
                        ...prev,
                        [slot.id]: event.target.value
                      }))
                    }
                    placeholder="Име на служител"
                  />
                  <button
                    className="take-button"
                    onClick={() => reserveSlot(slot.id)}
                  >
                    Заеми
                  </button>
                </>
              ) : (
                <button
                  className="release-button"
                  onClick={() => releaseSlot(slot.id)}
                >
                  Освободи
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
