import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

function formatMoney(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function buildShortDisplayName(tab) {
  const members = Array.isArray(tab?.members)
    ? tab.members.filter(Boolean)
    : tab?.name
      ? [tab.name]
      : [];

  if (members.length === 0) return "Unnamed Tab";
  if (members.length === 1) return members[0];
  if (members.length === 2) return `${members[0]} & ${members[1]}`;
  return `${members[0]}, ${members[1]} & ${members[2]}`;
}

function getSessionStorageKey(tableId) {
  return `tabsplit-session-${tableId}`;
}

function getOrCreateSessionKey(tableId) {
  const storageKey = getSessionStorageKey(tableId);
  let value = sessionStorage.getItem(storageKey);

  if (!value) {
    value = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(storageKey, value);
  }

  return value;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildFullName(name, surname) {
  return `${String(name || "").trim()} ${String(surname || "").trim()}`.trim();
}

function formatModifierLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatItemModifiers(item) {
  const modifiers = item?.modifiers || {};
  const entries = Object.entries(modifiers).filter(([, value]) => value);

  return entries
    .map(([key, value]) => `${formatModifierLabel(key)}: ${value}`)
    .join(" · ");
}

async function ensureTableDocument(tableId) {
  const ref = doc(db, "tables", tableId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      guests: [],
      waiterName: "",
      tableStatus: "open",
    });
  }
}

const pageShellStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #ecfff3 0%, #f7fbff 55%, #eef8f2 100%)",
  fontFamily: "Arial, sans-serif",
  padding: 16,
};

const sectionCardStyle = {
  background: "#ffffff",
  border: "2px solid #b7d8c0",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 12px 30px rgba(54, 101, 74, 0.08)",
};

const mobileInputWrapStyle = {
  display: "grid",
  gap: 10,
  width: "100%",
  maxWidth: 420,
  marginBottom: 16,
  boxSizing: "border-box",
};

const inputStyle = {
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid #b7cad5",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  fontSize: 16,
};

const greenOptionButtonStyle = {
  padding: "22px 20px",
  borderRadius: 18,
  border: "2px solid #8bc79a",
  background: "#dff7e5",
  color: "#123524",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 18,
  minWidth: 220,
  minHeight: 88,
  boxShadow: "0 8px 20px rgba(88, 140, 102, 0.12)",
};

const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #bfd0da",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
};

const primaryActionStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "#69b3d9",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "bold",
};

const tabCardStyle = (serviceRequested) => ({
  width: "100%",
  maxWidth: 700,
  margin: "0 auto",
  display: "block",
  padding: 24,
  borderRadius: 18,
  background: serviceRequested ? "#fde9ec" : "#e3f6e8",
  border: serviceRequested ? "2px solid #c1121f" : "2px solid #9dceb0",
  textAlign: "center",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(88, 140, 102, 0.10)",
});

export default function GuestView() {
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get("table");

  const [table, setTable] = useState(null);
  const [step, setStep] = useState("choose");
  const [tabType, setTabType] = useState("single");

  const [singleName, setSingleName] = useState("");
  const [singleSurname, setSingleSurname] = useState("");

  const [sharedNames, setSharedNames] = useState([
    { name: "", surname: "" },
    { name: "", surname: "" },
  ]);

  const [joinRequestName, setJoinRequestName] = useState("");
  const [joinRequestSurname, setJoinRequestSurname] = useState("");

  const [rejoinName, setRejoinName] = useState("");
  const [rejoinSurname, setRejoinSurname] = useState("");

  const [selectedExistingTabId, setSelectedExistingTabId] = useState("");
  const [selectedMergeTabId, setSelectedMergeTabId] = useState("");
  const [selectedTabViewId, setSelectedTabViewId] = useState(null);

  const [currentTabId, setCurrentTabId] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [hasResolvedSession, setHasResolvedSession] = useState(false);

  useEffect(() => {
    if (!tableId) return;

    const initialise = async () => {
      await ensureTableDocument(tableId);
      setSessionKey(getOrCreateSessionKey(tableId));
    };

    initialise();
  }, [tableId]);

  useEffect(() => {
    if (!tableId) return;

    const ref = doc(db, "tables", tableId);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const data = snapshot.data() || null;
      setTable(data);

      const liveTabs = data?.guests || [];
      const mySessionKey = getOrCreateSessionKey(tableId);

      const foundTab = liveTabs.find(
        (tab) =>
          tab.ownerKey === mySessionKey ||
          (tab.viewerKeys || []).includes(mySessionKey)
      );

      if (foundTab) {
        setCurrentTabId(foundTab.id);
        setStep("myTab");
      } else {
        setCurrentTabId("");
        setStep("choose");
      }

      setHasResolvedSession(true);
    });

    return () => unsubscribe();
  }, [tableId]);

  const tabs = table?.guests || [];

  const currentTab = useMemo(() => {
    return tabs.find((tab) => tab.id === currentTabId) || null;
  }, [tabs, currentTabId]);

  const waiterName = table?.waiterName || "Not set yet";
  const isOwner = currentTab ? currentTab.ownerKey === sessionKey : false;
  const isMemberOfCurrentTab =
    !!currentTab &&
    (currentTab.ownerKey === sessionKey ||
      (currentTab.viewerKeys || []).includes(sessionKey));

  const availableMergeTabs = useMemo(() => {
    return tabs.filter((tab) => tab.id !== currentTabId);
  }, [tabs, currentTabId]);

  const selectedTabView =
    tabs.find((tab) => tab.id === selectedTabViewId) || null;

  const pendingJoinRequests =
    isOwner && currentTab ? currentTab.joinRequests || [] : [];

  useEffect(() => {
    if (!currentTab || !isOwner) return;

    const joinRequests = currentTab.joinRequests || [];
    if (joinRequests.length > 0) {
      setSelectedTabViewId(currentTab.id);
    }
  }, [currentTab, isOwner]);

  const getTabSubtotal = (tab) => {
    return (tab?.items || []).reduce(
      (sum, item) => sum + Number(item.price || 0),
      0
    );
  };

  const getTabTip = (tab) => {
    const subtotal = getTabSubtotal(tab);
    const tipPercent = Number(tab?.tipPercent || 0);

    if (tipPercent <= 0) return 0;
    return subtotal * (tipPercent / 100);
  };

  const getTabTotalInclTip = (tab) => getTabSubtotal(tab) + getTabTip(tab);

  const createSingleTab = async () => {
    const cleanedName = singleName.trim();
    const cleanedSurname = singleSurname.trim();
    const fullName = buildFullName(cleanedName, cleanedSurname);

    if (!cleanedName || !cleanedSurname || !tableId || !sessionKey) {
      alert("Please enter both name and surname.");
      return;
    }

    const ref = doc(db, "tables", tableId);
    const snapshot = await getDoc(ref);
    const data = snapshot.data();

    const newTab = {
      id: Date.now().toString(),
      ownerName: fullName,
      ownerKey: sessionKey,
      name: fullName,
      members: [fullName],
      viewerKeys: [],
      items: [],
      tipPercent: 0,
      status: "active",
      readyToPay: false,
      serviceRequested: false,
      paidAt: null,
      joinRequests: [],
    };

    await updateDoc(ref, {
      guests: [...(data?.guests || []), newTab],
    });

    setCurrentTabId(newTab.id);
    setSingleName("");
    setSingleSurname("");
    setStep("myTab");
  };

  const createSharedTab = async () => {
    const cleanedNames = sharedNames
      .map((person) => buildFullName(person.name, person.surname))
      .filter(Boolean);

    const hasEmptyFields = sharedNames.some(
      (person) =>
        !String(person.name || "").trim() || !String(person.surname || "").trim()
    );

    if (hasEmptyFields || cleanedNames.length < 2 || !tableId || !sessionKey) {
      alert("Please enter both name and surname for each person.");
      return;
    }

    const ref = doc(db, "tables", tableId);
    const snapshot = await getDoc(ref);
    const data = snapshot.data();

    const newTab = {
      id: Date.now().toString(),
      ownerName: cleanedNames[0],
      ownerKey: sessionKey,
      name: cleanedNames.join(" & "),
      members: cleanedNames,
      viewerKeys: [],
      items: [],
      tipPercent: 0,
      status: "active",
      readyToPay: false,
      serviceRequested: false,
      paidAt: null,
      joinRequests: [],
    };

    await updateDoc(ref, {
      guests: [...(data?.guests || []), newTab],
    });

    setCurrentTabId(newTab.id);
    setSharedNames([
      { name: "", surname: "" },
      { name: "", surname: "" },
    ]);
    setStep("myTab");
  };

  const sendJoinRequest = async () => {
    const cleanedName = joinRequestName.trim();
    const cleanedSurname = joinRequestSurname.trim();
    const fullName = buildFullName(cleanedName, cleanedSurname);

    if (!cleanedName || !cleanedSurname || !selectedExistingTabId || !tableId || !sessionKey) {
      alert("Please enter both name and surname and choose a tab.");
      return;
    }

    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== selectedExistingTabId) return tab;

      const existingRequests = tab.joinRequests || [];
      const alreadyRequested = existingRequests.some(
        (request) => request.sessionKey === sessionKey
      );

      if (alreadyRequested) return tab;

      return {
        ...tab,
        joinRequests: [
          ...existingRequests,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: fullName,
            sessionKey,
          },
        ],
      };
    });

    await updateDoc(ref, { guests: updatedTabs });

    alert("Join request sent.");
    setJoinRequestName("");
    setJoinRequestSurname("");
    setSelectedExistingTabId("");
    setStep("choose");
  };

  const acceptJoinRequest = async (requestId) => {
    if (!currentTab || !isOwner || !tableId) return;

    const requestToAccept = (currentTab.joinRequests || []).find(
      (request) => request.id === requestId
    );

    if (!requestToAccept) return;

    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== currentTab.id) return tab;

      const newMembers = [...(tab.members || []), requestToAccept.name];

      return {
        ...tab,
        members: [...new Set(newMembers)],
        viewerKeys: [
          ...new Set([...(tab.viewerKeys || []), requestToAccept.sessionKey]),
        ],
        joinRequests: (tab.joinRequests || []).filter(
          (request) => request.id !== requestId
        ),
        name: [...new Set(newMembers)].join(" & "),
      };
    });

    await updateDoc(ref, { guests: updatedTabs });
  };

  const rejectJoinRequest = async (requestId) => {
    if (!currentTab || !isOwner || !tableId) return;

    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== currentTab.id) return tab;

      return {
        ...tab,
        joinRequests: (tab.joinRequests || []).filter(
          (request) => request.id !== requestId
        ),
      };
    });

    await updateDoc(ref, { guests: updatedTabs });
  };

  const mergeTabIntoMyTab = async () => {
    if (!currentTab || !selectedMergeTabId || !tableId || !isOwner) return;

    const tabToMerge = tabs.find((tab) => tab.id === selectedMergeTabId);
    if (!tabToMerge) return;

    const mergedTabs = tabs
      .map((tab) => {
        if (tab.id !== currentTab.id) return tab;

        const combinedMembers = [
          ...(tab.members || []),
          ...(tabToMerge.members || []),
        ];

        const combinedViewerKeys = [
          ...(tab.viewerKeys || []),
          ...(tabToMerge.viewerKeys || []),
          tabToMerge.ownerKey,
        ];

        return {
          ...tab,
          members: [...new Set(combinedMembers)],
          viewerKeys: [...new Set(combinedViewerKeys.filter(Boolean))],
          items: [...(tab.items || []), ...(tabToMerge.items || [])],
          tipPercent: Math.max(
            Number(tab.tipPercent || 0),
            Number(tabToMerge.tipPercent || 0)
          ),
          readyToPay:
            Boolean(tab.readyToPay) || Boolean(tabToMerge.readyToPay),
          serviceRequested:
            Boolean(tab.serviceRequested) ||
            Boolean(tabToMerge.serviceRequested),
          status:
            tab.status === "paid" && tabToMerge.status === "paid"
              ? "paid"
              : "active",
          name: [...new Set(combinedMembers)].join(" & "),
        };
      })
      .filter((tab) => tab.id !== tabToMerge.id);

    const ref = doc(db, "tables", tableId);

    await updateDoc(ref, {
      guests: mergedTabs,
    });

    setSelectedMergeTabId("");
  };

  const rejoinSession = async () => {
    const cleanedName = rejoinName.trim();
    const cleanedSurname = rejoinSurname.trim();
    const fullName = normalizeName(buildFullName(cleanedName, cleanedSurname));

    if (!cleanedName || !cleanedSurname || !tableId || !sessionKey) {
      alert("Please enter both name and surname.");
      return;
    }

    const matchedTabs = tabs.filter((tab) => {
      const ownerMatch = normalizeName(tab.ownerName) === fullName;
      const memberMatch = (tab.members || []).some(
        (member) => normalizeName(member) === fullName
      );
      return ownerMatch || memberMatch;
    });

    if (matchedTabs.length === 0) {
      alert("No tab found for that name on this table.");
      return;
    }

    if (matchedTabs.length > 1) {
      alert(
        "More than one matching tab was found. Please use Join Someone's Tab for now."
      );
      return;
    }

    const matchedTab = matchedTabs[0];
    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== matchedTab.id) return tab;

      const alreadyLinked =
        tab.ownerKey === sessionKey || (tab.viewerKeys || []).includes(sessionKey);

      if (alreadyLinked) return tab;

      return {
        ...tab,
        viewerKeys: [...new Set([...(tab.viewerKeys || []), sessionKey])],
      };
    });

    await updateDoc(ref, { guests: updatedTabs });
    setRejoinName("");
    setRejoinSurname("");
  };

  const updateTipPercent = async (tipPercent) => {
    if (!currentTab || !tableId || !isOwner) return;

    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== currentTab.id) return tab;

      return {
        ...tab,
        tipPercent: Number(tipPercent),
      };
    });

    await updateDoc(ref, { guests: updatedTabs });
  };

  const requestService = async () => {
    if (!currentTab || !tableId || !isMemberOfCurrentTab) return;

    const ref = doc(db, "tables", tableId);

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== currentTab.id) return tab;

      return {
        ...tab,
        serviceRequested: true,
      };
    });

    await updateDoc(ref, { guests: updatedTabs });
  };

  const addSharedNameInput = () => {
    setSharedNames((prev) => [...prev, { name: "", surname: "" }]);
  };

  const updateSharedPerson = (index, field, value) => {
    setSharedNames((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const openTabView = (tabId) => {
    setSelectedTabViewId(tabId);
  };

  const closeTabView = () => {
    setSelectedTabViewId(null);
  };

  if (!tableId) {
    return <div style={{ padding: 30 }}>Invalid QR code</div>;
  }

  if (!hasResolvedSession) {
    return (
      <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
        Loading table...
      </div>
    );
  }

  const showSetupOptions = !currentTab;

  return (
    <div style={pageShellStyle}>
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          ...sectionCardStyle,
          padding: 18,
        }}
      >
        <div
          style={{
            marginBottom: 24,
            background: "linear-gradient(135deg, #dff7e5 0%, #eef9ff 100%)",
            border: "2px solid #b7d8c0",
            borderRadius: 18,
            padding: 18,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 30 }}>Welcome to Table {tableId}</h2>
          <div style={{ color: "#4f6672", marginTop: 8, fontSize: 16 }}>
            Your waiter / waitress is <strong>{waiterName}</strong>
          </div>
        </div>

        {showSetupOptions && step === "choose" && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                marginBottom: 8,
              }}
            >
              <button
                onClick={() => {
                  setTabType("single");
                  setStep("create");
                }}
                style={greenOptionButtonStyle}
              >
                Create My Own Tab
              </button>

              <button
                onClick={() => {
                  setTabType("shared");
                  setStep("create");
                }}
                style={greenOptionButtonStyle}
              >
                Create A Shared Tab
              </button>

              <button
                onClick={() => setStep("joinExisting")}
                style={greenOptionButtonStyle}
              >
                Join Someone`s Tab
              </button>

              <button
                onClick={() => setStep("rejoin")}
                style={greenOptionButtonStyle}
              >
                Get Back to my Tab
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "create" && tabType === "single" && (
          <div style={{ ...sectionCardStyle, marginBottom: 24, background: "#f7fff9" }}>
            <div style={{ fontWeight: "bold", marginBottom: 12, fontSize: 20 }}>
              Create my own tab
            </div>

            <div style={mobileInputWrapStyle}>
              <input
                type="text"
                placeholder="Enter name"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={singleSurname}
                onChange={(e) => setSingleSurname(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={createSingleTab} style={primaryActionStyle}>
                Create My Tab
              </button>

              <button onClick={() => setStep("choose")} style={secondaryButtonStyle}>
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "create" && tabType === "shared" && (
          <div style={{ ...sectionCardStyle, marginBottom: 24, background: "#f7fff9" }}>
            <div style={{ fontWeight: "bold", marginBottom: 12, fontSize: 20 }}>
              Create a shared tab
            </div>

            <div style={{ color: "#5d7180", marginBottom: 12 }}>
              Add the names that should appear on this shared bill.
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                width: "100%",
                maxWidth: 460,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            >
              {sharedNames.map((person, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #c6ddd0",
                    background: "#edf9f0",
                  }}
                >
                  <input
                    type="text"
                    placeholder={`Person ${index + 1} name`}
                    value={person.name}
                    onChange={(e) =>
                      updateSharedPerson(index, "name", e.target.value)
                    }
                    style={inputStyle}
                  />

                  <input
                    type="text"
                    placeholder={`Person ${index + 1} surname`}
                    value={person.surname}
                    onChange={(e) =>
                      updateSharedPerson(index, "surname", e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={addSharedNameInput} style={secondaryButtonStyle}>
                Add Another Name
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={createSharedTab} style={primaryActionStyle}>
                Create Shared Tab
              </button>

              <button onClick={() => setStep("choose")} style={secondaryButtonStyle}>
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "joinExisting" && (
          <div style={{ ...sectionCardStyle, marginBottom: 24, background: "#f7fff9" }}>
            <div style={{ fontWeight: "bold", marginBottom: 12, fontSize: 20 }}>
              Join someone`s tab
            </div>

            <div style={mobileInputWrapStyle}>
              <input
                type="text"
                placeholder="Enter name"
                value={joinRequestName}
                onChange={(e) => setJoinRequestName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={joinRequestSurname}
                onChange={(e) => setJoinRequestSurname(e.target.value)}
                style={inputStyle}
              />
            </div>

            {tabs.length === 0 ? (
              <div style={{ color: "#6c7a92", marginBottom: 16 }}>
                No tabs exist yet for this table.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                {tabs.map((tab) => (
                  <label
                    key={tab.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "16px 16px",
                      borderRadius: 14,
                      border: "2px solid #c6ddd0",
                      background: "#edf9f0",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="existingTab"
                      checked={selectedExistingTabId === tab.id}
                      onChange={() => setSelectedExistingTabId(tab.id)}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: "bold", fontSize: 17 }}>
                        {buildShortDisplayName(tab)}
                      </div>
                      <div style={{ color: "#5d7180", marginTop: 4 }}>
                        Excl: {formatMoney(getTabSubtotal(tab))} · Tip: {formatMoney(getTabTip(tab))} · Incl: {formatMoney(getTabTotalInclTip(tab))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={sendJoinRequest} style={primaryActionStyle}>
                Send Join Request
              </button>

              <button onClick={() => setStep("choose")} style={secondaryButtonStyle}>
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "rejoin" && (
          <div style={{ ...sectionCardStyle, marginBottom: 24, background: "#f7fff9" }}>
            <div style={{ fontWeight: "bold", marginBottom: 12, fontSize: 20 }}>
              Get back to my tab
            </div>

            <div style={mobileInputWrapStyle}>
              <input
                type="text"
                placeholder="Enter name"
                value={rejoinName}
                onChange={(e) => setRejoinName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={rejoinSurname}
                onChange={(e) => setRejoinSurname(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={rejoinSession} style={primaryActionStyle}>
                Rejoin My Tab
              </button>

              <button onClick={() => setStep("choose")} style={secondaryButtonStyle}>
                Back
              </button>
            </div>
          </div>
        )}

        {currentTab && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: 10,
                  textAlign: "center",
                  fontSize: 20,
                }}
              >
                My tab
              </div>

              <button onClick={() => openTabView(currentTab.id)} style={tabCardStyle(currentTab.serviceRequested)}>
                <div style={{ fontWeight: "bold", fontSize: 20 }}>
                  {buildShortDisplayName(currentTab)}
                </div>
                <div style={{ color: "#4f6672", marginTop: 6 }}>
                  Tab Owner: <strong>{currentTab.ownerName || currentTab.members?.[0] || "Unknown"}</strong>
                </div>
                <div style={{ color: "#4f6672", marginTop: 6 }}>
                  Status: {currentTab.status}
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Total excl:</strong> {formatMoney(getTabSubtotal(currentTab))}
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Tip:</strong> {formatMoney(getTabTip(currentTab))}
                </div>
                <div style={{ marginTop: 4, fontWeight: "bold" }}>
                  Total incl: {formatMoney(getTabTotalInclTip(currentTab))}
                </div>
                <div style={{ marginTop: 12, color: "#3f7a54", fontWeight: "bold" }}>
                  Select to View Tab
                </div>
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: 10,
                  textAlign: "center",
                  fontSize: 20,
                }}
              >
                Other tabs at this table
              </div>

              {availableMergeTabs.length === 0 ? (
                <div style={{ color: "#6c7a92", textAlign: "center" }}>No other tabs at this table.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {availableMergeTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => openTabView(tab.id)}
                      style={tabCardStyle(tab.serviceRequested)}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 18 }}>
                        {buildShortDisplayName(tab)}
                      </div>

                      <div style={{ color: "#4f6672", marginTop: 6 }}>
                        Tab Owner: <strong>{tab.ownerName || tab.members?.[0] || "Unknown"}</strong>
                      </div>

                      <div style={{ color: "#4f6672", marginTop: 6 }}>
                        Status: {tab.status}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <strong>Total excl:</strong> {formatMoney(getTabSubtotal(tab))}
                      </div>

                      <div style={{ marginTop: 4 }}>
                        <strong>Tip:</strong> {formatMoney(getTabTip(tab))}
                      </div>

                      <div style={{ marginTop: 4, fontWeight: "bold" }}>
                        Total incl: {formatMoney(getTabTotalInclTip(tab))}
                      </div>

                      <div style={{ marginTop: 12, color: "#3f7a54", fontWeight: "bold" }}>
                        Select to View Tab
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...sectionCardStyle, background: "#f7fff9" }}>
              <div style={{ fontWeight: "bold", marginBottom: 10, fontSize: 18 }}>
                Add guest to my tab
              </div>

              {!isOwner ? (
                <div style={{ color: "#6c7a92" }}>
                  Only the tab owner can merge guests into this tab.
                </div>
              ) : availableMergeTabs.length === 0 ? (
                <div style={{ color: "#6c7a92" }}>No other tabs available yet.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                    {availableMergeTabs.map((tab) => (
                      <label
                        key={tab.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "14px 14px",
                          borderRadius: 12,
                          border: "2px solid #c6ddd0",
                          background: "#edf9f0",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMergeTabId === tab.id}
                          onChange={() =>
                            setSelectedMergeTabId((prev) => (prev === tab.id ? "" : tab.id))
                          }
                        />

                        <div>
                          <div style={{ fontWeight: "bold" }}>
                            {buildShortDisplayName(tab)}
                          </div>

                          <div style={{ color: "#5d7180", marginTop: 4 }}>
                            Excl {formatMoney(getTabSubtotal(tab))} · Tip {formatMoney(getTabTip(tab))} · Incl {formatMoney(getTabTotalInclTip(tab))}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button onClick={mergeTabIntoMyTab} style={primaryActionStyle}>
                    Add Guest To My Tab
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {selectedTabView && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,28,51,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 18,
              padding: 24,
              border: "2px solid #b7d8c0",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: 24 }}>
                  {buildShortDisplayName(selectedTabView)}
                </div>

                <div style={{ color: "#6c7a92" }}>Waiter: {waiterName}</div>
              </div>

              <button onClick={closeTabView} style={secondaryButtonStyle}>
                Close
              </button>
            </div>

            {(selectedTabView.items || []).length === 0 ? (
              <div>No items yet</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {selectedTabView.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "#f5fbf6",
                      border: "1px solid #d5e6d9",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>{item.name}</div>

                    {formatItemModifiers(item) && (
                      <div style={{ color: "#6c7a92" }}>
                        {formatItemModifiers(item)}
                      </div>
                    )}

                    <div style={{ fontWeight: "bold" }}>
                      {formatMoney(item.price)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div>
                Total excl: <strong>{formatMoney(getTabSubtotal(selectedTabView))}</strong>
              </div>

              <div>
                Tip: <strong>{formatMoney(getTabTip(selectedTabView))}</strong>
              </div>

              <div>
                Total incl: <strong>{formatMoney(getTabTotalInclTip(selectedTabView))}</strong>
              </div>
            </div>

            {selectedTabView.id === currentTab?.id && (
              <>
                {isOwner && pendingJoinRequests.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontWeight: "bold", marginBottom: 10 }}>
                      Join requests
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {pendingJoinRequests.map((request) => (
                        <div
                          key={request.id}
                          style={{
                            border: "1px solid #d5e6d9",
                            borderRadius: 12,
                            padding: 12,
                            background: "#f5fbf6",
                          }}
                        >
                          <div style={{ fontWeight: "bold", marginBottom: 10 }}>
                            {request.name} wants to join your tab
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => acceptJoinRequest(request.id)}
                              style={{
                                padding: "10px 14px",
                                borderRadius: 10,
                                border: "none",
                                background: "#1d7f49",
                                color: "#fff",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              Accept
                            </button>

                            <button
                              onClick={() => rejectJoinRequest(request.id)}
                              style={secondaryButtonStyle}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isOwner && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontWeight: "bold", marginBottom: 6 }}>Tip</div>

                    <select
                      value={currentTab?.tipPercent || 0}
                      onChange={(e) => updateTipPercent(Number(e.target.value))}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #b7cad5",
                        width: "100%",
                        maxWidth: 180,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value={0}>0%</option>
                      {Array.from({ length: 11 }).map((_, i) => {
                        const val = 10 + i;
                        return (
                          <option key={val} value={val}>
                            {val}%
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <button
                  onClick={requestService}
                  style={{
                    marginTop: 16,
                    padding: 14,
                    width: "100%",
                    borderRadius: 12,
                    border: "none",
                    background: currentTab?.serviceRequested ? "#c1121f" : "#69b3d9",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  {currentTab?.serviceRequested ? "Service Requested" : "Select to Call for Service"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
