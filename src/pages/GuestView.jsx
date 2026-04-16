import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

function formatMoney(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function buildDisplayName(tab) {
  if (Array.isArray(tab?.members) && tab.members.length > 0) {
    return tab.members.join(" & ");
  }
  return tab?.name || "Unnamed Tab";
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
        "More than one matching tab was found. Please use Join Existing Tab for now."
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
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        fontFamily: "Arial, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 950,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e3e7ef",
          borderRadius: 18,
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>Welcome to Table {tableId}</h2>
          <div style={{ color: "#6c7a92", marginTop: 8 }}>
            Your waiter / waitress is <strong>{waiterName}</strong>
          </div>
        </div>

        {showSetupOptions && step === "choose" && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <button
                onClick={() => {
                  setTabType("single");
                  setStep("create");
                }}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "#0f1c33",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Single Tab
              </button>

              <button
                onClick={() => {
                  setTabType("shared");
                  setStep("create");
                }}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "#f4a000",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Shared Tab
              </button>

              <button
                onClick={() => setStep("joinExisting")}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Join Existing Tab
              </button>

              <button
                onClick={() => setStep("rejoin")}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid #ccd3e0",
                  background: "#eaf3ff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Rejoin Session
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "create" && tabType === "single" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: "bold", marginBottom: 12 }}>
              Create single tab
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 320, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Enter name"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={singleSurname}
                onChange={(e) => setSingleSurname(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={createSingleTab}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f1c33",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Create My Tab
              </button>

              <button
                onClick={() => setStep("choose")}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "create" && tabType === "shared" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: "bold", marginBottom: 12 }}>
              Create shared tab
            </div>

            <div style={{ color: "#6c7a92", marginBottom: 12 }}>
              Add the names that should appear on this shared bill.
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                maxWidth: 420,
                marginBottom: 16,
              }}
            >
              {sharedNames.map((person, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e3e7ef",
                    background: "#f8f9fc",
                  }}
                >
                  <input
                    type="text"
                    placeholder={`Person ${index + 1} name`}
                    value={person.name}
                    onChange={(e) =>
                      updateSharedPerson(index, "name", e.target.value)
                    }
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #ccd3e0",
                    }}
                  />

                  <input
                    type="text"
                    placeholder={`Person ${index + 1} surname`}
                    value={person.surname}
                    onChange={(e) =>
                      updateSharedPerson(index, "surname", e.target.value)
                    }
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #ccd3e0",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button
                onClick={addSharedNameInput}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Add Another Name
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={createSharedTab}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#f4a000",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Create Shared Tab
              </button>

              <button
                onClick={() => setStep("choose")}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "joinExisting" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: "bold", marginBottom: 12 }}>
              Join existing tab
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 320, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Enter name"
                value={joinRequestName}
                onChange={(e) => setJoinRequestName(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={joinRequestSurname}
                onChange={(e) => setJoinRequestSurname(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />
            </div>

            {tabs.length === 0 ? (
              <div style={{ color: "#6c7a92", marginBottom: 16 }}>
                No tabs exist yet for this table.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {tabs.map((tab) => (
                  <label
                    key={tab.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid #d9dfeb",
                      background: "#f8f9fc",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="existingTab"
                      checked={selectedExistingTabId === tab.id}
                      onChange={() => setSelectedExistingTabId(tab.id)}
                    />
                    <div>
                      <div style={{ fontWeight: "bold" }}>
                        {buildDisplayName(tab)}
                      </div>
                      <div style={{ color: "#6c7a92", marginTop: 4 }}>
                        Excl: {formatMoney(getTabSubtotal(tab))} · Tip:{" "}
                        {formatMoney(getTabTip(tab))} · Incl:{" "}
                        {formatMoney(getTabTotalInclTip(tab))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={sendJoinRequest}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f1c33",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Send Join Request
              </button>

              <button
                onClick={() => setStep("choose")}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {showSetupOptions && step === "rejoin" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: "bold", marginBottom: 12 }}>
              Rejoin session
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 320, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Enter name"
                value={rejoinName}
                onChange={(e) => setRejoinName(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />

              <input
                type="text"
                placeholder="Enter surname"
                value={rejoinSurname}
                onChange={(e) => setRejoinSurname(e.target.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  width: "100%",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={rejoinSession}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#2f6fb3",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Rejoin My Tab
              </button>

              <button
                onClick={() => setStep("choose")}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #ccd3e0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
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
                }}
              >
                My tab
              </div>

              <button
                onClick={() => openTabView(currentTab.id)}
                style={{
                  width: "100%",
                  maxWidth: 620,
                  margin: "0 auto",
                  display: "block",
                  padding: 20,
                  borderRadius: 16,
                  background: currentTab.serviceRequested ? "#dbeafe" : "#eaf3ff",
                  border: currentTab.serviceRequested
                    ? "2px solid #2f6fb3"
                    : "1px solid #cfe0f5",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 18 }}>
                  {buildDisplayName(currentTab)}
                </div>
                <div style={{ color: "#6c7a92", marginTop: 6 }}>
                  Tab Owner:{" "}
                  <strong>
                    {currentTab.ownerName || currentTab.members?.[0] || "Unknown"}
                  </strong>
                </div>
                <div style={{ color: "#6c7a92", marginTop: 6 }}>
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
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: 10,
                  textAlign: "center",
                }}
              >
                Other tabs at this table
              </div>

              {availableMergeTabs.length === 0 ? (
                <div style={{ color: "#6c7a92" }}>No other tabs at this table.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {availableMergeTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => openTabView(tab.id)}
                      style={{
                        width: "100%",
                        maxWidth: 620,
                        margin: "0 auto",
                        display: "block",
                        padding: 20,
                        borderRadius: 16,
                        background: tab.serviceRequested ? "#dbeafe" : "#eaf3ff",
                        border: tab.serviceRequested
                          ? "2px solid #2f6fb3"
                          : "1px solid #cfe0f5",
                        textAlign: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 16 }}>
                        {buildDisplayName(tab)}
                      </div>

                      <div style={{ color: "#6c7a92", marginTop: 6 }}>
                        Tab Owner:{" "}
                        <strong>
                          {tab.ownerName || tab.members?.[0] || "Unknown"}
                        </strong>
                      </div>

                      <div style={{ color: "#6c7a92", marginTop: 6 }}>
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
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: "bold", marginBottom: 10 }}>
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
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #d9dfeb",
                          background: "#f8f9fc",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="mergeTab"
                          checked={selectedMergeTabId === tab.id}
                          onChange={() => setSelectedMergeTabId(tab.id)}
                        />

                        <div>
                          <div style={{ fontWeight: "bold" }}>
                            {buildDisplayName(tab)}
                          </div>

                          <div style={{ color: "#6c7a92", marginTop: 4 }}>
                            Excl {formatMoney(getTabSubtotal(tab))} · Tip{" "}
                            {formatMoney(getTabTip(tab))} · Incl{" "}
                            {formatMoney(getTabTotalInclTip(tab))}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={mergeTabIntoMyTab}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 10,
                      border: "none",
                      background: "#0f1c33",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
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
            padding: 20,
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
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: 24 }}>
                  {buildDisplayName(selectedTabView)}
                </div>

                <div style={{ color: "#6c7a92" }}>Waiter: {waiterName}</div>
              </div>

              <button
                onClick={closeTabView}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  background: "#fff",
                }}
              >
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
                      borderRadius: 10,
                      background: "#f8f9fc",
                      border: "1px solid #eee",
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
                Total incl:{" "}
                <strong>{formatMoney(getTabTotalInclTip(selectedTabView))}</strong>
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
                            border: "1px solid #d9dfeb",
                            borderRadius: 12,
                            padding: 12,
                            background: "#f8f9fc",
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
                              style={{
                                padding: "10px 14px",
                                borderRadius: 10,
                                border: "1px solid #d9dfeb",
                                background: "#fff",
                                color: "#0f1c33",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
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
                        borderRadius: 8,
                        border: "1px solid #ccc",
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
                    padding: 12,
                    width: "100%",
                    borderRadius: 10,
                    border: "none",
                    background: "#c1121f",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Request Service
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}