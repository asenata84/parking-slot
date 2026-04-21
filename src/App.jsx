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
      window.alert("Моля, въведете име на служител, който заема мястото.");
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

  const resetSlots = () => {
    if (window.confirm("Наистина ли искате да освободите всички паркоместа?")) {
      setSlots(defaultSlots);
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Паркоместа за служители</h1>
        <p>
          Маркирайте паркомясто, когато паркирате, и го освободете, когато
          тръгнете. В момента има само 5 служебни места.
        </p>
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
                  <button onClick={() => reserveSlot(slot.id)}>
                    Резервирай
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

        <div className="actions-row">
          <button className="reset-button" onClick={resetSlots}>
            Освободи всички места
          </button>
        </div>
      </main>

      <footer>
        <p>
          Това приложение може да се ползва като самостоятелен React проект. За
          интеграция в Microsoft Teams може да се добави като таб/приставка към
          вашата Teams среда.
        </p>
      </footer>
    </div>
  );
}

export default App;
